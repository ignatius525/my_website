/*
 * Which track each route is actually running on right now.
 * Ported from fun-mta (mta_map/active.py).
 *
 * The static schedule carries every pattern a route has ever been assigned
 * (the E's shapes cover Queens Boulevard local as well as express), so the
 * drawn network is derived from the feeds instead: every TripUpdate names the
 * stops its train will call at, which resolves to the track it will run over.
 * Sightings are held for a window so a line does not blink out between trains.
 */

import { ACTIVE_TRACK_WINDOW } from './config.js';
import { normaliseTarget } from './locator.js';
import { edgeKey } from './network.js';

export class ActiveTrack {
  constructor(windowS = ACTIVE_TRACK_WINDOW) {
    this.windowS = windowS;
    // "route|edge" -> last time a train was scheduled over it
    this.seen = new Map();
    this.version = 0;
    this.dirty = true;
  }

  get size() { return this.seen.size; }

  /** Record the track every live train is routed over. */
  observe(net, trains, now) {
    for (const train of trains) {
      const [, calls] = normaliseTarget(train, net);
      const route = net.displayRoute(train.route_id);
      for (let i = 0; i < calls.length - 1; i++) {
        for (const edge of edgesBetween(net, calls[i].stop_id, calls[i + 1].stop_id)) {
          const key = `${route}|${edge}`;
          if (!this.seen.has(key)) this.dirty = true;
          this.seen.set(key, now);
        }
      }
    }
  }

  expire(now) {
    for (const [k, t] of this.seen) {
      if (now - t > this.windowS) {
        this.seen.delete(k);
        this.dirty = true;
      }
    }
  }

  /** route -> Set of edge keys it is running over. */
  byRoute() {
    const out = new Map();
    for (const k of this.seen.keys()) {
      const bar = k.indexOf('|');
      const route = k.slice(0, bar);
      if (!out.has(route)) out.set(route, new Set());
      out.get(route).add(k.slice(bar + 1));
    }
    return out;
  }

  /**
   * An id for the current active set that changes exactly when the set does,
   * so geometry is only rebuilt when service actually changed. (The Python
   * hashes the sorted set; a counter bumped on change is equivalent here.)
   */
  fingerprint() {
    if (this.dirty) {
      this.version += 1;
      this.dirty = false;
    }
    return `active-${this.version}`;
  }
}

/**
 * Track edges a train covers going from stop `a` to stop `b`, falling back to
 * a stitched path the way the locator does so a pair without its own segment
 * does not leave a hole in the drawn line.
 */
function* edgesBetween(net, a, b) {
  const seg = net.segment(a, b);
  const chain = seg ? [seg] : (net.findPath(a, b) || []);
  for (const part of chain) {
    const { via } = part;
    for (let i = 0; i < via.length - 1; i++) yield edgeKey(via[i], via[i + 1]);
  }
}
