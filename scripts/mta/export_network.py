"""Export the static subway network for the in-browser live map.

The live map (src/subway/) runs the fun-mta pipeline in a Web Worker, so the
static network it needs (stops, routes, stop-pair segments and the track edges
used to bundle parallel lines) is built once here by the original Python code
and shipped as JSON. Nothing in this file re-implements that build; it only
re-shapes `mta_map.network.Network` for the browser.

Usage (needs the fun-mta package, Python >= 3.10):

    pip install -e /path/to/fun-mta
    python scripts/mta/export_network.py            # -> src/subway/data/network.json

Rerun when MTA publishes a new static GTFS (the map keeps working on an older
export: stop pairs missing from it fall back to graph or straight-line paths).

Ordering is part of the format. The browser port walks track edges in exactly
the order `Network.build_track_lines` does, because walk order decides which
way each bundle is wound, and with it which side of the rails each route is
drawn on. That order depends on CPython's iteration order of two-point
frozensets, which JavaScript cannot reproduce, so it is recorded here:

* each edge carries, per route, the global position of that route's first
  occurrence of it in the shape loop, and the direction it was met in;
* `tuple(frozenset((p, q)))` and `tuple(frozenset((q, p)))` are recorded as two
  flags, so the port can tell which endpoint Python would unpack first.
"""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

from mta_map import network
from mta_map.network import _quantise

SCHEMA = 1
DEFAULT_OUT = Path(__file__).resolve().parents[2] / "src" / "subway" / "data" / "network.json"


def _first_is(pair, a) -> int:
    """1 if iterating frozenset `pair` yields `a` first, else 0."""
    return 1 if tuple(pair)[0] == a else 0


def export(net: network.Network) -> dict:
    stops = {
        s.stop_id: [s.name, round(s.lon, 6), round(s.lat, 6), s.parent]
        for s in net.stops.values()
    }
    routes = {
        r.route_id: [r.short_name, r.long_name, r.color, r.text_color, r.sort_order]
        for r in net.routes.values()
    }
    segments = [
        [seg.from_stop, seg.to_stop, seg.length_m, sorted(seg.routes),
         [[x, y] for x, y in seg.via]]
        for seg in net.segments.values()
    ]

    # Mirror the loop in Network.build_track_lines (active=None) exactly.
    edges: dict[frozenset, dict] = {}
    position = 0
    for shape_id, pts in net.shapes.items():
        raw = net.shape_routes.get(shape_id, "")
        route = net.display_route(raw)
        if not route or raw != route:
            continue
        for i in range(len(pts) - 1):
            a, b = _quantise(pts[i]), _quantise(pts[i + 1])
            if a == b:
                continue
            rec = edges.setdefault(frozenset((a, b)), {})
            if route not in rec:
                rec[route] = (position, a, b)
            position += 1

    out_edges = []
    for key, per_route in edges.items():
        p, q = sorted(key)
        out_edges.append([
            [p[0], p[1]], [q[0], q[1]],
            # Which endpoint tuple(frozenset(...)) yields first, for each
            # insertion order: 1 means p comes out first.
            _first_is(frozenset((p, q)), p),
            _first_is(frozenset((q, p)), p),
            {r: [pos, 0 if (a, b) == (p, q) else 1] for r, (pos, a, b) in per_route.items()},
        ])

    return {
        "schema": SCHEMA,
        "gtfs_version": net.version,
        "built_at": int(time.time()),
        "stops": stops,
        "routes": routes,
        "segments": segments,
        "edges": out_edges,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("-o", "--out", type=Path, default=DEFAULT_OUT)
    args = parser.parse_args()
    # Round-trip through the cache format so the export matches what the
    # server would load (segment lengths are rounded in the cache).
    net = network.Network.from_json(network.load().to_json())
    data = export(net)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(data, separators=(",", ":")))
    print(
        f"{args.out}: {len(data['stops'])} stops, {len(data['segments'])} segments, "
        f"{len(data['edges'])} edges, {args.out.stat().st_size / 1e6:.2f} MB "
        f"(GTFS {data['gtfs_version']})"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
