/*
 * The static subway network and the drawn (bundled, offset) line geometry.
 * Ported from fun-mta (mta_map/network.py).
 *
 * Geometry is keyed on stop *pairs*, not on shape_id: the realtime trip_id
 * carries only a truncated shape hint (80 of 658 live trains were ambiguous,
 * 80 more named patterns in no static feed). Every consecutive stop pair in
 * the schedule has its own polyline, so a live train's path is stitched from
 * the stops the feed reports, which survives reroutes and skip-stop patterns.
 *
 * The static part (stops, routes, segments, track edges) is built offline by
 * the original Python and shipped as src/subway/data/network.json (see
 * scripts/mta/export_network.py). What depends on live data -- which track is
 * in use, and therefore how shared rails fan out into parallel lines -- is
 * rebuilt here whenever service changes.
 */

import {
  bearingBetween, cumulative, haversine, KX, KY, polylineLength,
} from './geo.js';
import { pyFloorDiv, pyMod, pySum } from './py.js';

export const NETWORK_SCHEMA = 1;

// How sharply a route's drawn line may turn while still counting as one
// continuous stroke. Measured over 16992 unambiguous nodes, a real
// continuation turns 1.3 deg at the median and 10.3 deg at p99; looser lets the
// walk U-turn at a wye and draw the route back alongside itself.
const ROUTE_PATH_MAX_TURN = 60.0;
// A chain sitting this close (median, metres) to a longer chain of the same
// route is retracing track that route already has drawn.
const DUPLICATE_CHAIN_M = 40.0;

/* Points are [lon, lat] arrays already quantised to 6 dp by the exporter, so a
 * point's key is just its two numbers. An undirected edge is keyed with its
 * endpoints in Python tuple order, smaller first. */
export const ptKey = (p) => `${p[0]},${p[1]}`;
const ptLess = (a, b) => (a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]));
export const edgeKey = (a, b) => (ptLess(b, a)
  ? `${ptKey(b)}|${ptKey(a)}` : `${ptKey(a)}|${ptKey(b)}`);
const samePt = (a, b) => a[0] === b[0] && a[1] === b[1];
const segKey = (a, b) => `${a}>${b}`;

/** Insertion-ordered multimap of point -> neighbouring points. */
class Adjacency {
  constructor() { this.map = new Map(); }

  get(p) {
    const k = ptKey(p);
    let entry = this.map.get(k);
    if (!entry) {
      entry = { pt: p, next: [] };
      this.map.set(k, entry);
    }
    return entry;
  }

  link(a, b) {
    this.get(a).next.push(b);
    this.get(b).next.push(a);
  }

  points() { return [...this.map.values()].map((e) => e.pt); }

  degree(p) { return this.get(p).next.length; }
}

export class Network {
  constructor(data) {
    if (!data || data.schema !== NETWORK_SCHEMA) {
      throw new Error(`network data schema ${data && data.schema} (expected ${NETWORK_SCHEMA})`);
    }
    this.version = data.gtfs_version || '';

    this.stops = new Map();
    for (const [id, [name, lon, lat, parent]] of Object.entries(data.stops)) {
      this.stops.set(id, { stop_id: id, name, lon, lat, parent, point: [lon, lat] });
    }
    // Colours end up in map styles and legend CSS, and the data file is
    // rebuilt by a nightly job from a third-party zip: accept only #rrggbb.
    const hex = (c, fallback) => (typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c) ? c : fallback);
    this.routes = new Map();
    for (const [id, [short, long, color, text, sort]] of Object.entries(data.routes)) {
      this.routes.set(id, {
        route_id: id, short_name: String(short), long_name: String(long),
        color: hex(color, '#6D6E71'), text_color: hex(text, '#FFFFFF'),
        sort_order: Number.isFinite(sort) ? sort : 9999,
      });
    }

    this.segments = new Map();
    this.successors = new Map();
    this.predecessors = new Map();
    this.stopRoutes = new Map();
    const push = (m, k, v) => { if (!m.has(k)) m.set(k, []); m.get(k).push(v); };
    for (const [a, b, length, routes, via] of data.segments) {
      const seg = { from_stop: a, to_stop: b, via, length_m: length, routes: new Set(routes) };
      this.segments.set(segKey(a, b), seg);
      push(this.successors, a, b);
      push(this.predecessors, b, a);
      for (const s of [a, b]) {
        if (!this.stopRoutes.has(s)) this.stopRoutes.set(s, new Set());
        for (const r of routes) this.stopRoutes.get(s).add(r);
      }
    }

    // Static track edges, with what build_track_lines needs to reproduce
    // Python's iteration order exactly (see export_network.py).
    this.edges = new Map();
    for (const [p, q, pFirstPQ, pFirstQP, first] of data.edges) {
      this.edges.set(edgeKey(p, q), {
        p, q, pFirstPQ, pFirstQP,
        first: Object.entries(first).map(([route, [pos, dir]]) => ({ route, pos, dir })),
      });
    }
  }

  /** The endpoints of edge `rec`, in the order Python's tuple(frozenset((a, b))) yields them. */
  static unpack(rec, a) {
    const insertedPQ = samePt(a, rec.p);
    const pFirst = insertedPQ ? rec.pFirstPQ : rec.pFirstQP;
    return pFirst ? [rec.p, rec.q] : [rec.q, rec.p];
  }

  /** Collapse express variants (6X, 7X, FX) into the line they run on. */
  displayRoute(routeId) {
    if (routeId.endsWith('X') && this.routes.has(routeId.slice(0, -1))) return routeId.slice(0, -1);
    return routeId;
  }

  /** Order routes by MTA's published route_sort_order. */
  routeOrder(routes) {
    const order = (r) => (this.routes.has(r) ? this.routes.get(r).sort_order : 9999);
    return [...routes].sort((a, b) => (order(a) - order(b)) || (a < b ? -1 : a > b ? 1 : 0));
  }

  segment(a, b) { return this.segments.get(segKey(a, b)) || null; }

  /** Fallback geometry: a straight line between two known stops. */
  straightSegment(a, b) {
    const sa = this.stops.get(a);
    const sb = this.stops.get(b);
    if (!sa || !sb) return null;
    const via = [sa.point, sb.point];
    return { from_stop: a, to_stop: b, via, length_m: polylineLength(via), routes: new Set() };
  }

  /**
   * Best guess at the stop a train reached `stopId` from, used the first time
   * a train is seen. Prefers a predecessor on the same route, then the nearest.
   */
  predecessorOf(stopId, routeId = '') {
    let cands = this.predecessors.get(stopId) || [];
    if (!cands.length) return null;
    if (cands.length === 1) return cands[0];
    if (routeId) {
      const onRoute = cands.filter((c) => this.segment(c, stopId).routes.has(routeId));
      if (onRoute.length === 1) return onRoute[0];
      if (onRoute.length) cands = onRoute;
    }
    const target = this.stops.get(stopId);
    if (!target) return cands[0];
    let best = null;
    let bestD = Infinity;
    for (const c of cands) {
      const d = this.stops.has(c) ? haversine(this.stops.get(c).point, target.point) : Infinity;
      if (best === null || d < bestD) { best = c; bestD = d; }
    }
    return best;
  }

  /** Shortest chain of segments from `a` to `b`, for pairs with no direct segment. */
  findPath(a, b, maxHops = 4) {
    if (a === b) return [];
    const direct = this.segment(a, b);
    if (direct) return [direct];
    let frontier = [[a, []]];
    const seen = new Set([a]);
    for (let hop = 0; hop < maxHops; hop++) {
      const next = [];
      for (const [node, path] of frontier) {
        for (const succ of this.successors.get(node) || []) {
          if (succ === b) {
            const chain = [...path, succ];
            const segs = [];
            let prev = a;
            for (const s of chain) { segs.push(this.segment(prev, s)); prev = s; }
            return segs;
          }
          if (!seen.has(succ)) {
            seen.add(succ);
            next.push([succ, [...path, succ]]);
          }
        }
      }
      frontier = next;
      if (!frontier.length) break;
    }
    return null;
  }

  /* ---------------------------------------------------- drawn geometry --- */

  /**
   * Bundle shared rails into parallel-drawable runs (build_track_lines).
   *
   * Keyed on track geometry, not stops: an express and a local share rails
   * while stopping in different places (the 4/5 and the 6 share no stop pair
   * between 59 St and 86 St). With `active`, a route only contributes to the
   * edges it is currently running over; a route with no sightings at all keeps
   * its scheduled track (the 42 St Shuttle never appears in the feeds, and
   * absence of data is not evidence of absence of trains).
   *
   * Returns the edge index: edge -> { routes, from, to } with the direction
   * each chain was wound, which decides the side each route is drawn on.
   */
  buildEdgeIndex(active) {
    const included = [];
    for (const [key, rec] of this.edges) {
      let firstPos = Infinity;
      let firstDir = 0;
      const routes = [];
      for (const { route, pos, dir } of rec.first) {
        const live = active ? (active.get(route) || null) : null;
        if (live && live.size && !live.has(key)) continue;
        routes.push(route);
        if (pos < firstPos) { firstPos = pos; firstDir = dir; }
      }
      if (!routes.length) continue;
      const inserted = firstDir === 0 ? rec.p : rec.q;
      included.push({ pos: firstPos, routes, pair: Network.unpack(rec, inserted) });
    }
    included.sort((x, y) => x.pos - y.pos);

    const byRoutes = new Map();
    for (const { routes, pair } of included) {
      const ordered = this.routeOrder(routes);
      const k = ordered.join(',');
      if (!byRoutes.has(k)) byRoutes.set(k, { routes: ordered, edges: [] });
      byRoutes.get(k).edges.push(pair);
    }

    const index = new Map();
    for (const { routes, edges } of byRoutes.values()) {
      const adjacent = new Adjacency();
      for (const [a, b] of edges) adjacent.link(a, b);
      const used = new Set();

      const walk = (start) => {
        for (const first of [...adjacent.get(start).next]) {
          if (used.has(edgeKey(start, first))) continue;
          let cursor = start;
          let nxt = first;
          for (;;) {
            const k = edgeKey(cursor, nxt);
            used.add(k);
            index.set(k, { routes, from: cursor, to: nxt });
            if (adjacent.degree(nxt) !== 2) break;
            const onward = adjacent.get(nxt).next.filter((p) => !used.has(edgeKey(nxt, p)));
            if (!onward.length) break;
            cursor = nxt;
            nxt = onward[0];
          }
        }
      };
      // Endpoints and junctions first so chains run end to end, then any
      // closed loop that is left.
      for (const p of adjacent.points().filter((pt) => adjacent.degree(pt) !== 2)) walk(p);
      for (const p of adjacent.points()) walk(p);
    }
    return index;
  }

  /**
   * Drawn geometry for one set of active track (build_display): each route
   * as continuous polylines with a per-vertex sideways offset, plus the edge
   * index and drawn offsets used to put train dots on their own line.
   */
  buildDisplay(active) {
    const index = this.buildEdgeIndex(active);
    const { paths, drawn } = this.routePaths(index);
    return new DisplayNetwork(this, paths, index, drawn);
  }

  /**
   * Every route as continuous polylines with per-vertex offsets
   * (_route_paths_from). Chains are cut only where the route itself ends or
   * branches, never where its bundle changes, which keeps each line unbroken;
   * the offset is eased over `smoothM` so a route splays gradually.
   */
  routePaths(index, smoothM = 90.0, minLengthM = 150.0) {
    // A slot is relative to the direction its bundle was wound, and route
    // paths are independent walks (the F and the G run the shared Culver track
    // in opposite directions), so offsetPath flips the sign where a path runs
    // against the winding.
    const slots = new Map();
    const wound = new Map();
    for (const [k, { routes, from, to }] of index) {
      wound.set(k, [from, to]);
      const count = routes.length;
      routes.forEach((rid, i) => {
        if (!slots.has(rid)) slots.set(rid, new Map());
        slots.get(rid).set(k, i - (count - 1) / 2);
      });
    }

    const paths = [];
    for (const [routeId, edges] of slots) {
      const adjacent = new Adjacency();
      for (const k of edges.keys()) {
        const [from] = wound.get(k);
        const [a, b] = Network.unpack(this.edges.get(k), from);
        adjacent.link(a, b);
      }
      const used = new Set();

      const walk = (start) => {
        for (const first of [...adjacent.get(start).next]) {
          if (used.has(edgeKey(start, first))) continue;
          const path = [start];
          let cursor = start;
          let nxt = first;
          for (;;) {
            used.add(edgeKey(cursor, nxt));
            path.push(nxt);
            const onward = adjacent.get(nxt).next.filter((p) => !used.has(edgeKey(nxt, p)));
            if (!onward.length) break;
            let following = null;
            if (onward.length === 1 && adjacent.degree(nxt) === 2) {
              following = onward[0];
            } else {
              // A junction: carry on along the straightest continuation
              // instead of stopping, which would leave a dangling cap
              // mid-track (MTA's shapes carry variant trackage at Canal St
              // and Queens Plaza that otherwise sheds 20-50 m stubs).
              const inbound = bearingBetween(cursor, nxt);
              let bestTurn = ROUTE_PATH_MAX_TURN;
              for (const option of onward) {
                const turn = Math.abs(
                  pyMod(bearingBetween(nxt, option) - inbound + 180.0, 360.0) - 180.0,
                );
                if (turn < bestTurn) { bestTurn = turn; following = option; }
              }
              if (following === null) break;
            }
            cursor = nxt;
            nxt = following;
          }
          if (path.length >= 2) paths.push(offsetPath(routeId, path, edges, wound, smoothM));
        }
      };
      for (const p of adjacent.points().filter((pt) => adjacent.degree(pt) !== 2)) walk(p);
      for (const p of adjacent.points()) walk(p);
    }

    // Drop slivers of variant trackage, and chains that merely retrace track
    // a longer chain of the same route already covers. A route's last
    // remaining path is never dropped.
    const byRoute = new Map();
    for (const path of paths) {
      if (!byRoute.has(path.route_id)) byRoute.set(path.route_id, []);
      byRoute.get(path.route_id).push(path);
    }
    const kept = [];
    for (const group0 of byRoute.values()) {
      const group = [...group0].sort((x, y) => y.length_m - x.length_m);
      const chosen = [];
      for (const path of group) {
        if (path.length_m < minLengthM) continue;
        if (chosen.length && medianDistance(path.via, chosen) < DUPLICATE_CHAIN_M) continue;
        chosen.push(path);
      }
      kept.push(...(chosen.length ? chosen : [group[0]]));
    }

    // Where each route is actually drawn on each edge, in the canonical
    // (wound) direction, so a train and its line agree on which side of the
    // rails they are on -- including through the eased transitions.
    const drawn = new Map();
    for (const path of kept) {
      for (let i = 0; i < path.via.length - 1; i++) {
        const k = edgeKey(path.via[i], path.via[i + 1]);
        const offset = (path.offsets[i] + path.offsets[i + 1]) / 2;
        const [from, to] = wound.get(k);
        const forward = samePt(path.via[i], from) && samePt(path.via[i + 1], to);
        drawn.set(`${path.route_id}|${k}`, offset * (forward ? 1.0 : -1.0));
      }
    }
    return { paths: kept, drawn };
  }

  /** The stations GeoJSON (parent stations only), with the display routes serving each. */
  stopsGeojson() {
    const features = [];
    for (const s of this.stops.values()) {
      if (s.parent) continue;
      const routes = new Set();
      for (const child of [`${s.stop_id}N`, `${s.stop_id}S`]) {
        for (const r of this.stopRoutes.get(child) || []) routes.add(this.displayRoute(r));
      }
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
        properties: { stop_id: s.stop_id, name: s.name, routes: [...routes].sort() },
      });
    }
    return { type: 'FeatureCollection', features };
  }

  routesPayload() {
    const out = {};
    for (const r of this.routes.values()) {
      out[r.route_id] = {
        short_name: r.short_name, long_name: r.long_name,
        color: r.color, text_color: r.text_color, sort_order: r.sort_order,
      };
    }
    return out;
  }
}

/** Offset one route path per vertex, eased over `smoothM` metres (_offset_path). */
function offsetPath(routeId, path, slots, wound, smoothM) {
  const edgeOffsets = [];
  for (let i = 0; i < path.length - 1; i++) {
    const k = edgeKey(path[i], path[i + 1]);
    const [from, to] = wound.get(k);
    const forward = samePt(path[i], from) && samePt(path[i + 1], to);
    edgeOffsets.push(slots.get(k) * (forward ? 1.0 : -1.0));
  }
  // A vertex sits between two edges that may belong to different bundles.
  const vertex = [edgeOffsets[0]];
  for (let i = 1; i < path.length - 1; i++) vertex.push((edgeOffsets[i - 1] + edgeOffsets[i]) / 2);
  vertex.push(edgeOffsets[edgeOffsets.length - 1]);

  const cum = cumulative(path);
  const smoothed = [];
  for (let i = 0; i < path.length; i++) {
    let lo = i;
    let hi = i;
    while (lo > 0 && cum[i] - cum[lo - 1] <= smoothM) lo -= 1;
    while (hi < path.length - 1 && cum[hi + 1] - cum[i] <= smoothM) hi += 1;
    smoothed.push(pySum(vertex, lo, hi + 1) / (hi - lo + 1));
  }
  return {
    route_id: routeId, via: path, offsets: smoothed, length_m: polylineLength(path),
  };
}

/** Median distance (m) from `pts` to the nearest vertex of any path in `others`. */
function medianDistance(pts, others) {
  const cell = 60.0;
  const grid = new Map();
  const cellOf = (x, y) => `${pyFloorDiv(x, cell)},${pyFloorDiv(y, cell)}`;
  for (const other of others) {
    for (const [lon, lat] of other.via) {
      const x = lon * KX;
      const y = lat * KY;
      const k = cellOf(x, y);
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push([x, y]);
    }
  }
  if (!grid.size) return Infinity;
  const out = [];
  for (const [lon, lat] of pts) {
    const x = lon * KX;
    const y = lat * KY;
    const cx = pyFloorDiv(x, cell);
    const cy = pyFloorDiv(y, cell);
    let best = Infinity;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const [px, py] of grid.get(`${cx + dx},${cy + dy}`) || []) {
          best = Math.min(best, Math.hypot(px - x, py - y));
        }
      }
    }
    out.push(best);
  }
  out.sort((a, b) => a - b);
  return out[Math.floor(out.length / 2)];
}

/** Drawn geometry for one particular set of active track. */
export class DisplayNetwork {
  constructor(net, paths, edgeIndex, drawn) {
    this.net = net;
    this.paths = paths;
    this.edgeIndex = edgeIndex;
    this.drawn = drawn;
  }

  /**
   * Where `routeId` sits in the fan on track edge p0-p1:
   * [offset, sharedCount, bearingOfTheDrawnLine]. The bearing is the direction
   * the *line* was wound, not the train's travel: shifting by the train's own
   * heading would put a southbound dot on its neighbour's colour.
   */
  trackSlot(routeId, p0, p1) {
    const k = edgeKey(p0, p1);
    const found = this.edgeIndex.get(k);
    if (!found) return [0.0, 1, null];
    const display = this.net.displayRoute(routeId);
    const i = found.routes.indexOf(display);
    if (i < 0) return [0.0, 1, null];
    const key = `${display}|${k}`;
    const offset = this.drawn.has(key) ? this.drawn.get(key) : i - (found.routes.length - 1) / 2;
    return [offset, found.routes.length, bearingBetween(found.from, found.to)];
  }

  /** The line GeoJSON features: one per drawn route path, with per-vertex offsets. */
  lineFeatures() {
    return this.paths.map((path) => {
      const route = this.net.routes.get(path.route_id);
      return {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: path.via },
        properties: {
          route_id: path.route_id,
          color: route ? route.color : '#6D6E71',
          offsets: path.offsets,
        },
      };
    });
  }
}
