/*
 * The live snapshot: fetch the feeds, place every train, describe the drawn
 * lines. Ported from fun-mta (mta_map/store.py and the payloads in api.py).
 *
 * What the Python served as /api/trains, /api/network.geojson and
 * /api/health is produced here as plain objects for the map to draw.
 */

import { ActiveTrack } from './active.js';
import {
  ACTIVE_ONLY, FEED_STALE_AFTER, feedUrl, HTTP_RETRIES, HTTP_TIMEOUT_MS,
  MAX_FEED_BYTES, SUBWAY_FEEDS,
} from './config.js';
import { bestArrival, parseFeed } from './gtfsrt.js';
import { locate, normaliseTarget } from './locator.js';
import { Tracker } from './tracker.js';

const sleep = (ms) => new Promise((res) => { setTimeout(res, ms); });

/** Fetch one feed's bytes. Credentials, referrer and caches are all left out. */
async function fetchBytes(url, fetchImpl) {
  const resp = await fetchImpl(url, {
    cache: 'no-store',
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    redirect: 'error',
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const declared = Number(resp.headers.get('content-length'));
  if (declared > MAX_FEED_BYTES) throw new Error('response too large');
  const buf = new Uint8Array(await resp.arrayBuffer());
  if (buf.length > MAX_FEED_BYTES) throw new Error('response too large');
  return buf;
}

/** Fetch and parse one feed, retrying transient failures. Never throws. */
export async function fetchFeed(feedId, fetchImpl = fetch) {
  let last = '';
  for (let attempt = 0; attempt <= HTTP_RETRIES; attempt++) {
    try {
      const bytes = await fetchBytes(feedUrl(feedId), fetchImpl);
      const { timestamp, trains } = parseFeed(bytes, feedId);
      return {
        feed_id: feedId, ok: true, timestamp, trains, fetched_at: Date.now() / 1000,
      };
    } catch (err) {
      last = String((err && err.message) || err).slice(0, 200);
      if (attempt < HTTP_RETRIES) await sleep(500 * (attempt + 1));
    }
  }
  return {
    feed_id: feedId, ok: false, error: last, trains: [], timestamp: 0, fetched_at: Date.now() / 1000,
  };
}

export class Store {
  constructor(net) {
    this.net = net;
    this.tracker = new Tracker();
    this.active = new ActiveTrack();
    // Until the first poll lands nothing says a route is idle, so start from
    // the full scheduled network and narrow it once data arrives.
    this.display = net.buildDisplay(null);
    this.networkVersion = 'scheduled';
    // Trains from feeds that failed this round are carried over, so one feed
    // outage dims one line rather than blanking the map.
    this.byFeed = new Map();
    this.health = new Map();
    for (const fid of Object.keys(SUBWAY_FEEDS)) {
      this.health.set(fid, {
        feed_id: fid, ok: false, timestamp: 0, fetched_at: 0, train_count: 0,
        error: '', consecutive_failures: 0,
      });
    }
    this.snapshot = null;
  }

  /** Poll every feed once and rebuild the snapshot. */
  async pollOnce(fetchImpl = fetch) {
    const results = await Promise.all(Object.keys(SUBWAY_FEEDS).map((f) => fetchFeed(f, fetchImpl)));
    this.ingest(results, Date.now() / 1000);
    return this.snapshot;
  }

  /** Fold feed results into the snapshot at time `now` (seconds). */
  ingest(results, now) {
    for (const r of results) {
      const h = this.health.get(r.feed_id);
      h.fetched_at = r.fetched_at;
      if (r.ok) {
        this.byFeed.set(r.feed_id, r.trains);
        Object.assign(h, {
          ok: true, timestamp: r.timestamp, error: '', train_count: r.trains.length,
          consecutive_failures: 0,
        });
      } else {
        h.ok = false;
        h.error = r.error;
        h.consecutive_failures += 1;
      }
    }
    const trains = [...this.byFeed.values()].flat();
    this.snapshot = this.place(trains, now);
  }

  /** Update which track counts as active, rebuilding geometry if it moved. */
  refreshDisplay(trains, now) {
    if (!ACTIVE_ONLY) return;
    this.active.observe(this.net, trains, now);
    this.active.expire(now);
    const version = this.active.fingerprint();
    if (version === this.networkVersion || !this.active.size) return;
    this.display = this.net.buildDisplay(this.active.byRoute());
    this.networkVersion = version;
  }

  place(trains, now) {
    // Geometry first: trains are positioned against the lines that will be
    // drawn, so their offsets have to come from the same display.
    this.refreshDisplay(trains, now);
    const placed = [];
    const counts = {};
    for (const train of trains) {
      const [target, calls] = normaliseTarget(train, this.net);
      const history = this.tracker.observe(train, target, now);
      const pos = locate(this.net, train, history, now, target, calls);
      counts[pos.resolution] = (counts[pos.resolution] || 0) + 1;
      if (pos.resolution === 'unplaceable') continue;
      placed.push([train, pos]);
    }
    this.tracker.expire(now);
    return {
      placed, updated_at: now, resolution_counts: counts,
      display: this.display, network_version: this.networkVersion,
    };
  }

  /** One train as the /api/trains feature (api._train_feature). */
  trainFeature(train, pos, display, now) {
    const { net } = this;
    const stop = net.stops.get(pos.to_stop || '');
    const route = net.routes.get(train.route_id);
    const call = train.calls.length ? train.calls[0] : null;
    const arrival = call ? bestArrival(call) : null;
    const terminus = net.stops.get(train.calls.length ? train.calls[train.calls.length - 1].stop_id : '');
    const [offset, shared, offsetBearing] = pos.offset_ref
      ? display.trackSlot(train.route_id, pos.offset_ref[0], pos.offset_ref[1])
      : [0.0, 1, null];
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [pos.lon, pos.lat] },
      properties: {
        key: train.key,
        train_id: train.train_id,
        route_id: train.route_id,
        // 6X collapses to 6, matching its colour and the line it rides.
        line: net.displayRoute(train.route_id),
        route_color: route ? route.color : '#6D6E71',
        route_text_color: route ? route.text_color : '#FFFFFF',
        direction: train.direction,
        is_assigned: train.is_assigned,
        status: train.current_status,
        bearing: pos.bearing,
        has_direction: pos.has_direction,
        offset,
        shared,
        offset_bearing: offsetBearing,
        progress: pos.progress,
        resolution: pos.resolution,
        next_stop: pos.to_stop,
        next_stop_name: stop ? stop.name : '',
        eta_seconds: arrival != null ? arrival - Math.trunc(now) : null,
        terminus: terminus ? terminus.name : '',
        actual_track: train.calls.length ? train.calls[0].actual_track : '',
        feed_timestamp: train.feed_timestamp,
        // The map advances along `via` between depart_ts and arrive_ts, so it
        // animates for a full minute without another poll.
        motion: { via: pos.via, depart_ts: pos.depart_ts, arrive_ts: pos.arrive_ts },
      },
    };
  }

  trainsPayload(now = Date.now() / 1000) {
    const snap = this.snapshot;
    const display = snap.display || this.display;
    return {
      updated_at: snap.updated_at,
      server_time: now,
      count: snap.placed.length,
      network_version: snap.network_version,
      features: snap.placed.map(([t, p]) => this.trainFeature(t, p, display, now)),
    };
  }

  healthPayload(now = Date.now() / 1000) {
    const feeds = [...this.health.values()].map((h) => {
      const age = h.timestamp ? now - h.timestamp : null;
      return {
        feed_id: h.feed_id, ok: h.ok, age_seconds: age,
        stale: age !== null && age > FEED_STALE_AFTER,
        trains: h.train_count, error: h.error,
      };
    });
    const placed = this.snapshot ? this.snapshot.placed.length : 0;
    return { ok: placed > 0 && feeds.every((f) => f.ok), trains: placed, feeds };
  }

  linesPayload() {
    const display = (this.snapshot && this.snapshot.display) || this.display;
    return {
      version: (this.snapshot && this.snapshot.network_version) || this.networkVersion,
      features: display.lineFeatures(),
    };
  }
}
