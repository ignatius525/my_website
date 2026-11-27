"""The static subway network: stops, line geometry and the stop-pair segment table.

Why a segment table instead of ``shape_id``
-------------------------------------------
The obvious approach -- read a train's ``shape_id`` and interpolate along that
shape -- does not work. The realtime ``trip_id`` carries only a truncated shape
hint, and measured against live data only 498 of 658 trains resolved to a
single shape: 80 were ambiguous prefixes (``A..S`` matches 13 shapes) and 80
named diversion patterns such as ``F..N69X297`` that exist in no static feed.

So geometry is keyed on *stop pairs* instead. Every pair of consecutive stops
that appears in any scheduled trip gets its own polyline, sliced out of the
parent shape. A live train's path is then stitched from the stops the feed
actually reports for it, which stays correct through reroutes and skip-stop
patterns. Measured coverage: 99.86% of live consecutive pairs resolve directly.
"""

from __future__ import annotations

import json
import logging
import math
import time
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path

from . import config, geo, static_gtfs
from .geo import Point

log = logging.getLogger(__name__)

CACHE_VERSION = 8

# Track edges are identified by their rounded endpoints, so shape geometry and
# the segment polylines sliced out of it must round identically -- hence one
# shared precision, applied both when caching and when forming an edge key.
COORD_PRECISION = 6

# Vertices this close are treated as the same point on the track network.
# Routes that genuinely share rails are coincident to 0.00 m in MTA's shapes,
# while the closest genuinely-separate tracks measured (the 7 and the 42 St
# shuttle at Times Sq) sit 11.5 m apart with nothing under 1 m, so there is a
# wide safety margin either side of this figure.
NODE_TOLERANCE_M = 1.5

# How sharply a route's drawn line may turn while still counting as the same
# continuous stroke.
#
# Measured over 16992 unambiguous (degree-2) nodes, a genuine continuation turns
# 1.3 deg at the median, 10.3 deg at p99, and exceeds 60 deg just six times. A
# looser threshold lets the walk U-turn at a wye and double back on itself,
# which draws as a small loop with the route running back alongside itself.
ROUTE_PATH_MAX_TURN = 60.0

# A chain whose vertices sit this close, on average, to a longer chain of the
# same route is retracing track that route already has drawn.
DUPLICATE_CHAIN_M = 40.0


def _quantise(p: Point) -> Point:
    return (round(p[0], COORD_PRECISION), round(p[1], COORD_PRECISION))


def _median_distance(pts: list[Point], others: list) -> float:
    """Median distance from `pts` to the nearest vertex of any polyline in
    `others`, in metres. Used to spot a chain that retraces existing track."""
    grid: dict[tuple[int, int], list[tuple[float, float]]] = defaultdict(list)
    cell = 60.0
    for other in others:
        for lon, lat in other.via:
            x, y = lon * geo.KX, lat * geo.KY
            grid[(int(x // cell), int(y // cell))].append((x, y))
    if not grid:
        return math.inf
    out = []
    for lon, lat in pts:
        x, y = lon * geo.KX, lat * geo.KY
        cx, cy = int(x // cell), int(y // cell)
        best = math.inf
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for px, py in grid.get((cx + dx, cy + dy), ()):
                    best = min(best, math.hypot(px - x, py - y))
        out.append(best)
    out.sort()
    return out[len(out) // 2]


def _clean_polyline(pts: list[Point]) -> list[Point]:
    """Quantise a polyline and drop consecutive duplicates.

    Applied at build time so in-memory geometry is bit-identical to the cached
    copy. Without it, a sliced endpoint could differ from its neighbouring
    vertex at full precision but collide once rounded for the cache, leaving a
    zero-length segment that only appeared after a cache round-trip.
    """
    out: list[Point] = []
    for pt in pts:
        q = _quantise(pt)
        if not out or out[-1] != q:
            out.append(q)
    return out


@dataclass(slots=True)
class Stop:
    stop_id: str
    name: str
    lon: float
    lat: float
    parent: str
    direction: str  # "N" | "S" | "" for parent stations

    @property
    def point(self) -> Point:
        return (self.lon, self.lat)


@dataclass(slots=True)
class Route:
    route_id: str
    short_name: str
    long_name: str
    color: str
    text_color: str
    sort_order: int = 9999


@dataclass(slots=True)
class TrackLine:
    """A run of physical track and every route that runs over it.

    Keyed on *track geometry*, not on stops. Keying on consecutive stop pairs
    seems natural but misses the most common overlap in New York: an express
    and a local sharing rails while stopping at different places. The 4/5
    express runs 59 St -> 86 St while the 6 stops at 68 St and 77 St in
    between, so the two never share a stop pair and both drew down the middle
    of Lexington Avenue on top of each other.

    MTA generates every shape from a common track centreline, so shapes that
    share rails share *exact* vertices -- 56.5% of the 9097 distinct edges carry
    more than one route. Bundling on the edges themselves catches express and
    local together (A/C: 653 edges, N/R: 564, 4/6: 208).
    """

    routes: tuple[str, ...]
    via: list[Point]

    @property
    def length_m(self) -> float:
        return geo.polyline_length(self.via)


@dataclass(slots=True)
class RoutePath:
    """One continuous run of a single route, with its sideways offset per vertex.

    Drawing each constant-offset stretch as its own feature leaves visible
    breaks: where a bundle gains or loses a route every remaining route shifts
    sideways, and separate features cannot meet across that shift, so the map
    grows notches and dangling stubs at junctions.

    A route is therefore emitted as one unbroken polyline carrying an offset
    value at every vertex. The offset is applied to the geometry rather than by
    MapLibre's per-feature ``line-offset``, so a route eases from one slot to
    the next and the line stays continuous.
    """

    route_id: str
    via: list[Point]
    offsets: list[float]

    @property
    def length_m(self) -> float:
        return geo.polyline_length(self.via)


@dataclass(slots=True)
class Segment:
    """Track geometry between two consecutive stops, in travel direction."""

    from_stop: str
    to_stop: str
    via: list[Point]
    length_m: float
    routes: frozenset[str] = frozenset()

    def cum(self) -> list[float]:
        return geo.cumulative(self.via)


class Network:
    def __init__(
        self,
        stops: dict[str, Stop],
        routes: dict[str, Route],
        shapes: dict[str, list[Point]],
        shape_routes: dict[str, str],
        segments: dict[tuple[str, str], Segment],
        version: str = "",
    ) -> None:
        self.stops = stops
        self.routes = routes
        self.shapes = shapes
        self.shape_routes = shape_routes
        self.segments = segments
        self.version = version

        self.successors: dict[str, list[str]] = defaultdict(list)
        self.predecessors: dict[str, list[str]] = defaultdict(list)
        self.stop_routes: dict[str, set[str]] = defaultdict(set)
        for (a, b), seg in segments.items():
            self.successors[a].append(b)
            self.predecessors[b].append(a)
            self.stop_routes[a] |= seg.routes
            self.stop_routes[b] |= seg.routes
        self._cum_cache: dict[tuple[str, str], list[float]] = {}
        self._edge_index: dict[frozenset[Point], tuple[tuple[str, ...], Point, Point]] | None = None
        self._drawn_offsets: dict[tuple[str, frozenset[Point]], float] | None = None
        self._filtered_index: dict | None = None

    # -------------------------------------------------------- track lines --

    def display_route(self, route_id: str) -> str:
        """Collapse express variants into the line they run on.

        ``6X``, ``7X`` and ``FX`` are express patterns of ``6``, ``7`` and
        ``F``. GTFS gives them their base route's colour because they are the
        same line; fanning them out separately would be wrong.
        """
        if route_id.endswith("X") and route_id[:-1] in self.routes:
            return route_id[:-1]
        return route_id

    def parent_of(self, stop_id: str) -> str:
        stop = self.stops.get(stop_id)
        if stop is None:
            return stop_id
        return stop.parent or stop_id

    def _route_order(self, routes) -> tuple[str, ...]:
        """Order routes by MTA's published route_sort_order."""
        return tuple(sorted(
            routes,
            key=lambda r: (self.routes[r].sort_order if r in self.routes else 9999, r),
        ))

    def static_edge_index(self) -> dict:
        """The edge index for the full static network, built if needed."""
        if self._edge_index is None:
            self.build_track_lines()
        assert self._edge_index is not None
        return self._edge_index

    def build_track_lines(
        self, active: dict[str, set[frozenset[Point]]] | None = None
    ) -> list[TrackLine]:
        """Bundle shared rails into parallel-drawable runs.

        With `active` supplied, a route only contributes to an edge it is
        currently running over, so the drawn map reflects the pattern in force
        rather than every pattern in the schedule (see :mod:`mta_map.active`).

        Every shape contributes its consecutive vertex pairs as undirected track
        edges. Edges carrying the identical route set are then chained into long
        polylines, so a trunk like Lexington Avenue becomes one ``4/5/6`` run
        rather than hundreds of fragments. Chaining stops wherever the route set
        changes or the track branches, which is exactly where the fan has to be
        redrawn anyway.

        Also populates the edge index used to place train dots on the same
        parallel lines, recording which direction each chain was wound.
        """
        edge_routes: dict[frozenset[Point], set[str]] = defaultdict(set)
        for shape_id, pts in self.shapes.items():
            raw = self.shape_routes.get(shape_id, "")
            route = self.display_route(raw)
            if not route:
                continue
            # Skip express-variant shapes. They are displayed as their base
            # route, so their own alignment would draw a *second* line for that
            # route: the FX shapes follow the Culver express track, which put a
            # phantom F about 72 m from the real one, sitting right on top of
            # the G through Brooklyn.
            #
            # Safe to drop, measured: 6X and 7X are 100% coincident with their
            # base route (median 0.0 m, nothing beyond 25 m), and FX diverges
            # for only 0.96 km -- exactly the express track we do not want drawn
            # separately. Segment geometry still uses these shapes, so express
            # stop pairs keep their track.
            if raw != route:
                continue
            # A route with no realtime presence at all is left unfiltered: the
            # 42 St Shuttle never appears in the feeds, so treating silence as
            # "not running" would erase a service that runs all day. Absence of
            # data is not evidence of absence of trains.
            live = None if active is None else (active.get(route) or None)
            for i in range(len(pts) - 1):
                a, b = _quantise(pts[i]), _quantise(pts[i + 1])
                if a == b:
                    continue
                edge = frozenset((a, b))
                if live is not None and edge not in live:
                    continue
                edge_routes[edge].add(route)

        by_routes: dict[tuple[str, ...], list[tuple[Point, Point]]] = defaultdict(list)
        for key, routes in edge_routes.items():
            a, b = tuple(key)
            by_routes[self._route_order(routes)].append((a, b))

        lines: list[TrackLine] = []
        index: dict[frozenset[Point], tuple[tuple[str, ...], Point, Point]] = {}

        for routes, edges in by_routes.items():
            adjacent: dict[Point, list[Point]] = defaultdict(list)
            for a, b in edges:
                adjacent[a].append(b)
                adjacent[b].append(a)
            used: set[frozenset[Point]] = set()

            def walk(start: Point) -> None:
                for first in list(adjacent[start]):
                    if frozenset((start, first)) in used:
                        continue
                    path = [start]
                    cursor, nxt = start, first
                    while True:
                        used.add(frozenset((cursor, nxt)))
                        index[frozenset((cursor, nxt))] = (routes, cursor, nxt)
                        path.append(nxt)
                        if len(adjacent[nxt]) != 2:
                            break
                        onward = [
                            p for p in adjacent[nxt]
                            if frozenset((nxt, p)) not in used
                        ]
                        if not onward:
                            break
                        cursor, nxt = nxt, onward[0]
                    if len(path) >= 2:
                        lines.append(TrackLine(routes, path))

            # Endpoints and junctions first so chains run end to end, then
            # anything left over, which is a closed loop.
            for point in [p for p in adjacent if len(adjacent[p]) != 2]:
                walk(point)
            for point in list(adjacent):
                walk(point)

        if active is None:
            self._edge_index = index
        else:
            self._filtered_index = index
        return lines

    def build_display(
        self, active: dict[str, set[frozenset[Point]]] | None
    ) -> DisplayNetwork:
        """Geometry for one particular set of active track.

        Bundles, offsets and the edge index all depend on which routes are
        running where, so they are computed together and handed out as one
        immutable object rather than left as mutable state on the network.
        """
        lines = self.build_track_lines(active)
        index = (self._filtered_index if active is not None else self._edge_index) or {}
        paths, drawn = self._route_paths_from(index)
        return DisplayNetwork(self, lines, paths, index, drawn)

    def build_route_paths(
        self, smooth_m: float = 90.0, min_length_m: float = 150.0
    ) -> list[RoutePath]:
        """Route paths for the full static network (see `_route_paths_from`)."""
        if self._edge_index is None:
            self.build_track_lines()
        assert self._edge_index is not None
        paths, drawn = self._route_paths_from(
            self._edge_index, smooth_m=smooth_m, min_length_m=min_length_m
        )
        self._drawn_offsets = drawn
        return paths

    def _route_paths_from(
        self,
        edge_index: dict,
        smooth_m: float = 90.0,
        min_length_m: float = 150.0,
    ) -> tuple[list[RoutePath], dict[tuple[str, frozenset[Point]], float]]:
        """Every route as continuous polylines with a per-vertex offset.

        Chains are cut only where the route itself genuinely ends or branches,
        never where its bundle changes, which is what keeps each line unbroken.
        The offset is then eased over `smooth_m` so a route splays away from its
        neighbours gradually instead of stepping sideways.
        """
        # route -> {edge: its slot in that edge's bundle}
        #
        # A slot is expressed relative to the direction the bundle was wound,
        # which is not necessarily the direction a given route's path happens to
        # run: the walks are independent, so the F and the G traverse the shared
        # Culver track in opposite directions. "Half a slot to the right of
        # travel" then puts them on the same physical side of the rails, drawing
        # them exactly on top of each other. `_offset_path` flips the sign when
        # a path runs against the winding.
        slots: dict[str, dict[frozenset[Point], float]] = defaultdict(dict)
        wound: dict[frozenset[Point], tuple[Point, Point]] = {}
        for key, (routes, wound_from, wound_to) in edge_index.items():
            count = len(routes)
            wound[key] = (wound_from, wound_to)
            for index, rid in enumerate(routes):
                slots[rid][key] = index - (count - 1) / 2

        paths: list[RoutePath] = []
        for route_id, edges in slots.items():
            adjacent: dict[Point, list[Point]] = defaultdict(list)
            for key in edges:
                a, b = tuple(key)
                adjacent[a].append(b)
                adjacent[b].append(a)
            used: set[frozenset[Point]] = set()

            def walk(start: Point) -> None:
                for first in list(adjacent[start]):
                    if frozenset((start, first)) in used:
                        continue
                    path = [start]
                    cursor, nxt = start, first
                    while True:
                        used.add(frozenset((cursor, nxt)))
                        path.append(nxt)
                        onward = [
                            p for p in adjacent[nxt]
                            if frozenset((nxt, p)) not in used
                        ]
                        if not onward:
                            break
                        if len(onward) == 1 and len(adjacent[nxt]) == 2:
                            following = onward[0]
                        else:
                            # A junction. Rather than stopping -- which leaves a
                            # dangling cap mid-track -- carry on along the
                            # straightest continuation, the standard
                            # "good continuation" rule for building strokes.
                            # MTA's shapes include variant trackage at places
                            # like Canal St and Queens Plaza, which branches a
                            # route's own graph and otherwise shed 20-50 m stubs
                            # exactly where the visual artefacts appeared.
                            inbound = geo.bearing_between(cursor, nxt)
                            following = None
                            best_turn = ROUTE_PATH_MAX_TURN
                            for option in onward:
                                turn = abs(
                                    (geo.bearing_between(nxt, option) - inbound + 180.0)
                                    % 360.0 - 180.0
                                )
                                if turn < best_turn:
                                    best_turn, following = turn, option
                            if following is None:
                                break
                        cursor, nxt = nxt, following
                    if len(path) >= 2:
                        paths.append(
                            self._offset_path(route_id, path, edges, wound, smooth_m)
                        )

            for point in [p for p in adjacent if len(adjacent[p]) != 2]:
                walk(point)
            for point in list(adjacent):
                walk(point)

        # Discard slivers of variant trackage. MTA's shapes carry short parallel
        # bits through complexes like Queens Plaza and Canal St; the route is
        # already drawn there by its main path, so these only add visual noise.
        # A route's last remaining path is never dropped.
        kept: list[RoutePath] = []
        by_route: dict[str, list[RoutePath]] = defaultdict(list)
        for path in paths:
            by_route[path.route_id].append(path)
        for route_id, group in by_route.items():
            group = sorted(group, key=lambda p: -p.length_m)
            chosen: list[RoutePath] = []
            for path in group:
                if path.length_m < min_length_m:
                    continue
                # Also drop a chain that merely retraces track an already-kept,
                # longer chain of the same route covers; drawing both doubles
                # the line.
                if chosen and _median_distance(path.via, chosen) < DUPLICATE_CHAIN_M:
                    continue
                chosen.append(path)
            kept.extend(chosen or [group[0]])

        # Record the offset each route is actually drawn at on each edge, so a
        # train can be placed on exactly the line it belongs to rather than on
        # the unsmoothed slot.
        # Record where each route is actually drawn on each edge, expressed in
        # the same canonical direction `track_slot` reports its bearing in, so a
        # train and its line agree on which side of the rails they are on.
        drawn_offsets: dict[tuple[str, frozenset[Point]], float] = {}
        for path in kept:
            for i in range(len(path.via) - 1):
                edge = frozenset((path.via[i], path.via[i + 1]))
                drawn = (path.offsets[i] + path.offsets[i + 1]) / 2
                wound_from, wound_to = wound[edge]
                forward = path.via[i] == wound_from and path.via[i + 1] == wound_to
                drawn_offsets[(path.route_id, edge)] = drawn * (1.0 if forward else -1.0)
        return kept, drawn_offsets

    @staticmethod
    def _offset_path(
        route_id: str,
        path: list[Point],
        slots: dict[frozenset[Point], float],
        wound: dict[frozenset[Point], tuple[Point, Point]],
        smooth_m: float,
    ) -> RoutePath:
        # Slots are relative to the winding of the bundle; the offset is applied
        # relative to the direction this path runs. Where the two disagree the
        # sign has to flip, or routes sharing track land on the same side.
        edge_offsets = []
        for i in range(len(path) - 1):
            key = frozenset((path[i], path[i + 1]))
            wound_from, wound_to = wound[key]
            forward = path[i] == wound_from and path[i + 1] == wound_to
            edge_offsets.append(slots[key] * (1.0 if forward else -1.0))
        # A vertex sits between two edges that may belong to different bundles.
        vertex = [edge_offsets[0]]
        for i in range(1, len(path) - 1):
            vertex.append((edge_offsets[i - 1] + edge_offsets[i]) / 2)
        vertex.append(edge_offsets[-1])

        # Ease the change over a fixed ground distance so the splay reads as a
        # gentle diagonal rather than a kink.
        cum = geo.cumulative(path)
        smoothed = []
        for i in range(len(path)):
            lo = hi = i
            while lo > 0 and cum[i] - cum[lo - 1] <= smooth_m:
                lo -= 1
            while hi < len(path) - 1 and cum[hi + 1] - cum[i] <= smooth_m:
                hi += 1
            smoothed.append(sum(vertex[lo:hi + 1]) / (hi - lo + 1))
        return RoutePath(route_id, path, smoothed)

    def track_slot(
        self, route_id: str, p0: Point, p1: Point
    ) -> tuple[float, int, float | None]:
        """Where `route_id` sits in the fan on the track edge p0-p1.

        Returns (offset, shared_count, bearing_of_the_drawn_line). The bearing
        is the direction the *line* was wound, which is not always the direction
        the train is travelling: the offset has to be applied to the same side
        the line was shifted, or a dot lands on the wrong neighbour's colour.
        """
        if self._edge_index is None:
            self.build_track_lines()
        assert self._edge_index is not None
        edge = frozenset((_quantise(p0), _quantise(p1)))
        found = self._edge_index.get(edge)
        if found is None:
            return 0.0, 1, None
        routes, wound_from, wound_to = found
        display = self.display_route(route_id)
        if display not in routes:
            return 0.0, 1, None
        if self._drawn_offsets is None:
            self.build_route_paths()
        assert self._drawn_offsets is not None
        # Prefer the offset the line is actually drawn at: the raw slot ignores
        # the easing applied where a bundle changes, which would leave a train
        # beside its line through the transition.
        offset = self._drawn_offsets.get(
            (display, edge), routes.index(display) - (len(routes) - 1) / 2
        )
        return offset, len(routes), geo.bearing_between(wound_from, wound_to)

    # ------------------------------------------------------------ lookups --

    def segment(self, a: str, b: str) -> Segment | None:
        return self.segments.get((a, b))

    def cum_for(self, seg: Segment) -> list[float]:
        key = (seg.from_stop, seg.to_stop)
        c = self._cum_cache.get(key)
        if c is None:
            c = seg.cum()
            self._cum_cache[key] = c
        return c

    def straight_segment(self, a: str, b: str) -> Segment | None:
        """Fallback geometry: a straight line between two known stops."""
        sa, sb = self.stops.get(a), self.stops.get(b)
        if sa is None or sb is None:
            return None
        via = [sa.point, sb.point]
        return Segment(a, b, via, geo.polyline_length(via), frozenset())

    def predecessor_of(self, stop_id: str, route_id: str = "") -> str | None:
        """Best guess at the stop a train reached `stop_id` from.

        Used only when we have no history for a train, i.e. the first time we
        ever see it. Prefers a predecessor served by the same route; falls back
        to a unique predecessor regardless of route.
        """
        cands = self.predecessors.get(stop_id) or []
        if not cands:
            return None
        if len(cands) == 1:
            return cands[0]
        if route_id:
            on_route = [
                c for c in cands
                if route_id in (self.segments[(c, stop_id)].routes or ())
            ]
            if len(on_route) == 1:
                return on_route[0]
            if on_route:
                cands = on_route
        # Ambiguous (a merge point). Pick the nearest, which for express/local
        # merges is the same physical approach anyway.
        target = self.stops.get(stop_id)
        if target is None:
            return cands[0]
        return min(
            cands,
            key=lambda c: geo.haversine(self.stops[c].point, target.point)
            if c in self.stops else float("inf"),
        )

    def find_path(self, a: str, b: str, max_hops: int = 4) -> list[Segment] | None:
        """Shortest chain of segments from `a` to `b`, for pairs with no direct
        segment (a train skipping stops the static schedule never skips)."""
        if a == b:
            return []
        direct = self.segment(a, b)
        if direct is not None:
            return [direct]
        frontier: list[tuple[str, list[str]]] = [(a, [])]
        seen = {a}
        for _ in range(max_hops):
            nxt: list[tuple[str, list[str]]] = []
            for node, path in frontier:
                for succ in self.successors.get(node, ()):
                    if succ == b:
                        chain = path + [succ]
                        prev = a
                        segs = []
                        for s in chain:
                            segs.append(self.segments[(prev, s)])
                            prev = s
                        return segs
                    if succ not in seen:
                        seen.add(succ)
                        nxt.append((succ, path + [succ]))
            frontier = nxt
            if not frontier:
                break
        return None

    # ---------------------------------------------------------------- io ---

    def to_json(self) -> dict:
        return {
            "cache_version": CACHE_VERSION,
            "gtfs_version": self.version,
            "built_at": int(time.time()),
            "stops": {
                s.stop_id: [s.name, round(s.lon, 6), round(s.lat, 6), s.parent, s.direction]
                for s in self.stops.values()
            },
            "routes": {
                r.route_id: [
                    r.short_name, r.long_name, r.color, r.text_color, r.sort_order
                ]
                for r in self.routes.values()
            },
            "shapes": {
                sid: [[x, y] for x, y in pts] for sid, pts in self.shapes.items()
            },
            "shape_routes": self.shape_routes,
            "segments": [
                [
                    seg.from_stop,
                    seg.to_stop,
                    round(seg.length_m, 1),
                    sorted(seg.routes),
                    [[x, y] for x, y in seg.via],
                ]
                for seg in self.segments.values()
            ],
        }

    @classmethod
    def from_json(cls, data: dict) -> Network:
        stops = {
            sid: Stop(sid, v[0], v[1], v[2], v[3], v[4])
            for sid, v in data["stops"].items()
        }
        routes = {
            rid: Route(rid, v[0], v[1], v[2], v[3], v[4] if len(v) > 4 else 9999)
            for rid, v in data["routes"].items()
        }
        shapes = {
            sid: [(p[0], p[1]) for p in pts] for sid, pts in data["shapes"].items()
        }
        segments = {}
        for a, b, length, rts, via in data["segments"]:
            segments[(a, b)] = Segment(
                a, b, [(p[0], p[1]) for p in via], length, frozenset(rts)
            )
        return cls(
            stops, routes, shapes, data.get("shape_routes", {}), segments,
            data.get("gtfs_version", ""),
        )

    def save(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(".json.part")
        tmp.write_text(json.dumps(self.to_json(), separators=(",", ":")))
        tmp.replace(path)
        log.info("network cached at %s (%.1f MB)", path, path.stat().st_size / 1e6)


# ------------------------------------------------------------------ build --


class DisplayNetwork:
    """Drawn geometry for one particular set of active track.

    Bundles, offsets and the edge index all shift when a route stops running
    over a stretch of rail, so they belong together and are rebuilt as a unit
    whenever the active set changes.
    """

    __slots__ = ("net", "lines", "paths", "edge_index", "drawn_offsets")

    def __init__(self, net, lines, paths, edge_index, drawn_offsets) -> None:
        self.net = net
        self.lines = lines
        self.paths = paths
        self.edge_index = edge_index
        self.drawn_offsets = drawn_offsets

    def track_slot(
        self, route_id: str, p0: Point, p1: Point
    ) -> tuple[float, int, float | None]:
        """Where `route_id` sits in the fan on the track edge p0-p1.

        Returns (offset, shared_count, bearing_of_the_drawn_line). The bearing is
        the direction the *line* was wound, which is not always the direction the
        train travels: the offset has to be applied to the side the line was
        shifted, or a dot lands on a neighbour's colour.
        """
        edge = frozenset((_quantise(p0), _quantise(p1)))
        found = self.edge_index.get(edge)
        if found is None:
            return 0.0, 1, None
        routes, wound_from, wound_to = found
        display = self.net.display_route(route_id)
        if display not in routes:
            return 0.0, 1, None
        offset = self.drawn_offsets.get(
            (display, edge), routes.index(display) - (len(routes) - 1) / 2
        )
        return offset, len(routes), geo.bearing_between(wound_from, wound_to)


def canonicalise_shapes(shapes: dict[str, list[Point]]) -> dict[str, list[Point]]:
    """Give every shape the same vertices wherever shapes share track.

    Shapes that run over the same rails are coincident to 0.00 m, but they are
    *sampled* differently: the E may carry a vertex every 200 m where the A has
    one every 50 m. Consecutive-vertex-pair edges therefore fail to match even
    though the geometry is identical -- of the E's 773 vertices only 91 matched
    the A exactly, while 90% of its length lies within 1 m of the A.

    Two passes fix it. First every vertex is snapped onto a shared node set, so
    near-identical vertices become one point. Then any node lying on a shape's
    segment is inserted into that shape, so a densely sampled route and a
    sparsely sampled one end up with identical vertex sequences along shared
    track and their edges match exactly.
    """
    t0 = time.time()
    cell = 25.0

    def key(p: Point) -> tuple[int, int]:
        return (int(p[0] * geo.KX // cell), int(p[1] * geo.KY // cell))

    nodes: dict[tuple[int, int], list[Point]] = defaultdict(list)

    def snap(p: Point) -> Point:
        """Return the shared node for `p`, creating one if none is near."""
        cx, cy = key(p)
        px, py = p[0] * geo.KX, p[1] * geo.KY
        best: Point | None = None
        best_d = NODE_TOLERANCE_M
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for node in nodes.get((cx + dx, cy + dy), ()):
                    d = math.hypot(node[0] * geo.KX - px, node[1] * geo.KY - py)
                    if d < best_d:
                        best_d, best = d, node
        if best is not None:
            return best
        node = _quantise(p)
        nodes[key(node)].append(node)
        return node

    # Pass 1: snap vertices onto shared nodes. Sorted for determinism.
    snapped: dict[str, list[Point]] = {}
    for shape_id in sorted(shapes):
        out: list[Point] = []
        for pt in shapes[shape_id]:
            node = snap(pt)
            if not out or out[-1] != node:
                out.append(node)
        snapped[shape_id] = out

    # Pass 2: insert any node that lies on a segment but is missing from it.
    inserted = 0
    result: dict[str, list[Point]] = {}
    for shape_id, pts in snapped.items():
        out = [pts[0]]
        for i in range(len(pts) - 1):
            a, b = pts[i], pts[i + 1]
            ax, ay = a[0] * geo.KX, a[1] * geo.KY
            bx, by = b[0] * geo.KX, b[1] * geo.KY
            dx, dy = bx - ax, by - ay
            span = dx * dx + dy * dy
            found: list[tuple[float, Point]] = []
            if span > 0:
                # Walk the grid cells the segment passes through.
                steps = max(1, int(math.sqrt(span) / cell) + 1)
                cells = set()
                for k in range(steps + 1):
                    t = k / steps
                    cells.add(key((a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]))))
                seen: set[Point] = set()
                for cx, cy in cells:
                    for ex in (-1, 0, 1):
                        for ey in (-1, 0, 1):
                            for node in nodes.get((cx + ex, cy + ey), ()):
                                if node in seen or node == a or node == b:
                                    continue
                                seen.add(node)
                                nx, ny = node[0] * geo.KX, node[1] * geo.KY
                                t = ((nx - ax) * dx + (ny - ay) * dy) / span
                                if not (0.0 < t < 1.0):
                                    continue
                                perp = math.hypot(nx - (ax + t * dx), ny - (ay + t * dy))
                                if perp <= NODE_TOLERANCE_M:
                                    found.append((t, node))
            for _, node in sorted(found):
                if out[-1] != node:
                    out.append(node)
                    inserted += 1
            if out[-1] != b:
                out.append(b)
        result[shape_id] = out

    log.info(
        "canonicalised %d shapes in %.1fs: %d shared nodes, %d vertices inserted",
        len(result), time.time() - t0, sum(len(v) for v in nodes.values()), inserted,
    )
    return result


def build(gtfs_zip: Path) -> Network:
    """Build the network from the static bundle. Takes ~30s; cache the result."""
    t0 = time.time()

    stops: dict[str, Stop] = {}
    for row in static_gtfs.read_rows(gtfs_zip, "stops.txt"):
        sid = row["stop_id"]
        direction = sid[-1] if sid[-1] in ("N", "S") and row.get("parent_station") else ""
        stops[sid] = Stop(
            sid,
            row["stop_name"],
            float(row["stop_lon"]),
            float(row["stop_lat"]),
            row.get("parent_station", ""),
            direction,
        )

    routes: dict[str, Route] = {}
    for row in static_gtfs.read_rows(gtfs_zip, "routes.txt"):
        rid = row["route_id"]
        routes[rid] = Route(
            rid,
            row.get("route_short_name") or rid,
            row.get("route_long_name", ""),
            "#" + (row.get("route_color") or "6D6E71"),
            "#" + (row.get("route_text_color") or "FFFFFF"),
            int(row.get("route_sort_order") or 9999),
        )

    shapes: dict[str, list[Point]] = defaultdict(list)
    raw: dict[str, list[tuple[int, float, float]]] = defaultdict(list)
    for row in static_gtfs.read_rows(gtfs_zip, "shapes.txt"):
        raw[row["shape_id"]].append(
            (int(row["shape_pt_sequence"]), float(row["shape_pt_lon"]), float(row["shape_pt_lat"]))
        )
    for sid, pts in raw.items():
        pts.sort()
        # Collapse duplicate consecutive vertices; they break bearing maths.
        clean: list[Point] = []
        for _, lon, lat in pts:
            if not clean or clean[-1] != (lon, lat):
                clean.append((lon, lat))
        if len(clean) >= 2:
            shapes[sid] = clean
    shapes = dict(shapes)
    del raw

    # Must happen before segments are sliced out of the shapes: the segment
    # polylines inherit these vertices, which is what lets a train's local edge
    # resolve against the track-bundle index.
    shapes = canonicalise_shapes(shapes)

    trip_shape: dict[str, str] = {}
    shape_routes: dict[str, str] = {}
    for row in static_gtfs.read_rows(gtfs_zip, "trips.txt"):
        sid = row["shape_id"]
        trip_shape[row["trip_id"]] = sid
        shape_routes.setdefault(sid, row["route_id"])

    # Stream stop_times once, emitting the consecutive stop pairs seen on each
    # shape. Only a single trip's worth of rows is ever buffered.
    pairs_by_shape: dict[str, set[tuple[str, str]]] = defaultdict(set)
    buf: list[tuple[int, str]] = []
    cur_trip = ""

    def flush(trip: str, rows: list[tuple[int, str]]) -> None:
        if not trip or len(rows) < 2:
            return
        shape = trip_shape.get(trip)
        if shape is None or shape not in shapes:
            return
        rows.sort()
        seq = [sid for _, sid in rows]
        bucket = pairs_by_shape[shape]
        for i in range(len(seq) - 1):
            if seq[i] != seq[i + 1]:
                bucket.add((seq[i], seq[i + 1]))

    for row in static_gtfs.read_rows(gtfs_zip, "stop_times.txt"):
        trip = row["trip_id"]
        if trip != cur_trip:
            flush(cur_trip, buf)
            buf = []
            cur_trip = trip
        buf.append((int(row["stop_sequence"]), row["stop_id"]))
    flush(cur_trip, buf)

    log.info(
        "collected pairs for %d shapes in %.1fs", len(pairs_by_shape), time.time() - t0
    )

    # Project each shape's stops onto its polyline, then slice out each pair.
    segments: dict[tuple[str, str], Segment] = {}
    seg_routes: dict[tuple[str, str], set[str]] = defaultdict(set)
    non_monotonic = 0
    max_offset = 0.0
    skipped: list[tuple[str, str, str]] = []

    for shape_id, pairs in pairs_by_shape.items():
        pts = shapes[shape_id]
        cum = geo.cumulative(pts)
        route = shape_routes.get(shape_id, "")

        # Stops are usually exact shape vertices (measured median offset 0.0 m),
        # so try a coordinate lookup before the O(n) projection.
        vertex_at: dict[tuple[int, int], int] = {}
        for i, (lon, lat) in enumerate(pts):
            vertex_at.setdefault((round(lon, 6), round(lat, 6)), i)

        involved = {s for pair in pairs for s in pair}
        dist: dict[str, float] = {}
        for sid in involved:
            st = stops.get(sid)
            if st is None:
                continue
            hit = vertex_at.get((round(st.lon, 6), round(st.lat, 6)))
            if hit is not None:
                dist[sid] = cum[hit]
            else:
                off, d = geo.project(pts, cum, st.point)
                dist[sid] = d
                max_offset = max(max_offset, off)

        for a, b in pairs:
            if a not in dist or b not in dist:
                skipped.append((shape_id, a, b))
                continue
            da, db = dist[a], dist[b]
            if db <= da:
                non_monotonic += 1
                continue
            key = (a, b)
            seg_routes[key].add(route)
            if key in segments:
                continue
            via = _clean_polyline(geo.slice_between(pts, cum, da, db))
            if len(via) < 2:
                continue
            segments[key] = Segment(a, b, via, db - da)

    for key, rts in seg_routes.items():
        if key in segments:
            segments[key].routes = frozenset(r for r in rts if r)

    log.info(
        "built %d segments from %d shapes in %.1fs "
        "(max stop offset %.1f m, %d non-monotonic pairs, %d unknown-stop pairs)",
        len(segments), len(shapes), time.time() - t0, max_offset, non_monotonic,
        len(skipped),
    )
    return Network(
        stops, routes, shapes, shape_routes, segments, static_gtfs.feed_version(gtfs_zip)
    )


def load(force_rebuild: bool = False) -> Network:
    """Load the network from cache, rebuilding when stale or absent."""
    gtfs_zip = static_gtfs.ensure_gtfs()
    version = static_gtfs.feed_version(gtfs_zip)
    path = config.NETWORK_JSON

    if not force_rebuild and path.exists():
        try:
            data = json.loads(path.read_text())
            cached_cache_version = data.get("cache_version")
            cached_gtfs = data.get("gtfs_version")
            if cached_cache_version == CACHE_VERSION and cached_gtfs == version:
                net = Network.from_json(data)
                log.info(
                    "loaded cached network: %d stops, %d segments, %d shapes",
                    len(net.stops), len(net.segments), len(net.shapes),
                )
                return net
            if cached_cache_version != CACHE_VERSION:
                log.info(
                    "network cache format is v%s, need v%s -- rebuilding",
                    cached_cache_version, CACHE_VERSION,
                )
            else:
                log.info(
                    "static GTFS changed (%s -> %s) -- rebuilding network",
                    cached_gtfs, version,
                )
        except (json.JSONDecodeError, KeyError, TypeError) as exc:
            log.warning("network cache unreadable (%s), rebuilding", exc)

    net = build(gtfs_zip)
    net.save(path)
    return net
