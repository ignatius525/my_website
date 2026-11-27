/*
 * Turn a feed observation into a point on the map.
 * Ported from fun-mta (mta_map/locator.py) -- the heart of the project.
 *
 * The MTA subway feeds contain no coordinates at all: across 658 live
 * vehicles, zero carried a GTFS-RT position. A train's location is rebuilt
 * from the stop it is heading for, the stop it last left, and the predicted
 * arrival, then interpolated along real track geometry.
 *
 * Positions are a pure function of (train, history, now), which is what lets
 * the map animate them between polls: it gets the same segment and timings
 * and advances `now` itself.
 */

import {
  MAX_PROGRESS, MAX_SPEED_MPS, MIN_SPEED_MPS, TYPICAL_SPEED_MPS,
} from './config.js';
import {
  bearingAt, cumulative, interpolate, segmentIndex,
} from './geo.js';
import {
  bestArrival, bestDeparture, STOPPED_AT,
} from './gtfsrt.js';
import { pyInt } from './py.js';

/**
 * Decide which stop a train is heading for, and drop stale or unusable calls.
 *
 * vehicle.stop_id equals the first predicted stop for 557 of 658 trains. The
 * rest: 21 name a stop partway down their own list (earlier entries are
 * stale, so the list is cut to start there), 56 name a stop missing from the
 * list (the list is fresher and wins), and 23 have no predicted stops at all.
 * Stops missing from the static feed (yard tracks like R60 and X22) are
 * dropped first, which lifts segment coverage from 98.1% to 99.86%.
 */
export function normaliseTarget(train, net) {
  let calls = train.calls.filter((c) => net.stops.has(c.stop_id));
  const here = train.current_stop_id;
  if (here && net.stops.has(here)) {
    const idx = calls.findIndex((c) => c.stop_id === here);
    if (idx >= 0) {
      calls = calls.slice(idx);
      return [here, calls];
    }
  }
  if (calls.length) return [calls[0].stop_id, calls];
  if (net.stops.has(here)) return [here, calls];
  return ['', calls];
}

function join(segments) {
  const via = [];
  let total = 0.0;
  for (const seg of segments) {
    let pts = seg.via;
    if (via.length && pts.length) {
      const last = via[via.length - 1];
      if (last[0] === pts[0][0] && last[1] === pts[0][1]) pts = pts.slice(1);
    }
    via.push(...pts);
    total += seg.length_m;
  }
  return [via, total];
}

/** Track geometry from stop `a` to stop `b`, with graceful degradation. */
export function resolvePath(net, a, b) {
  const seg = net.segment(a, b);
  if (seg) return [seg.via, seg.length_m, 'direct'];
  const chain = net.findPath(a, b);
  if (chain && chain.length) {
    const [via, total] = join(chain);
    return [via, total, 'graph'];
  }
  const straight = net.straightSegment(a, b);
  if (straight) return [straight.via, straight.length_m, 'straight'];
  return [[], 0.0, 'unplaceable'];
}

/**
 * Pick a (depart, arrive) pair implying a physically plausible speed. A
 * duration is only trusted if its implied speed lands in the configured band;
 * otherwise the arrival (the feed's own prediction) is kept and the departure
 * backed out of a sane speed.
 */
function timingWindow(lengthM, arriveTs, departedTs) {
  if (arriveTs == null) return null;
  const nominal = Math.max(1.0, lengthM / TYPICAL_SPEED_MPS);
  if (departedTs != null && arriveTs > departedTs) {
    let duration = arriveTs - departedTs;
    const speed = lengthM / duration;
    if (speed >= MIN_SPEED_MPS && speed <= MAX_SPEED_MPS) return [departedTs, arriveTs];
    const lo = lengthM / MAX_SPEED_MPS;
    const hi = lengthM / MIN_SPEED_MPS;
    duration = lengthM ? Math.min(Math.max(duration, lo), hi) : nominal;
    return [pyInt(arriveTs - duration), arriveTs];
  }
  return [pyInt(arriveTs - nominal), arriveTs];
}

/** The stretch of track a train standing at `target` is about to take. */
export function onwardSegment(net, target, calls) {
  if (calls.length < 2) return null;
  const nxt = calls[1].stop_id;
  let seg = net.segment(target, nxt);
  if (!seg) {
    const chain = net.findPath(target, nxt);
    seg = chain && chain.length ? chain[0] : net.straightSegment(target, nxt);
  }
  if (!seg || seg.via.length < 2) return null;
  return seg;
}

/** A train at a station: no interpolation, but point it where it will go. */
function atStation(net, stop, target, calls, resolution, extra) {
  const ahead = onwardSegment(net, target, calls);
  const heading = ahead ? bearingAt(ahead.via, 0) : null;
  return {
    lon: stop.lon,
    lat: stop.lat,
    bearing: heading || 0.0,
    progress: 0.0,
    resolution,
    has_direction: heading !== null,
    offset_ref: ahead ? [ahead.via[0], ahead.via[1]] : null,
    from_stop: null,
    to_stop: target,
    depart_ts: null,
    arrive_ts: null,
    via: [[stop.lon, stop.lat]],
    ...extra,
  };
}

/** Where `train` is at `now`, plus the motion vector to animate it. */
export function locate(net, train, history, now, target, calls) {
  if (!target) {
    // Measured: 10 of 658, all route H at H19N with no calls. H19 is one of
    // the realtime stop ids that exist in no static feed.
    return { resolution: 'unplaceable' };
  }
  const stop = net.stops.get(target);

  // Sitting in a station.
  if (train.current_status === STOPPED_AT && train.current_stop_id === target) {
    return atStation(net, stop, target, calls, 'stopped', {
      from_stop: target,
      depart_ts: calls.length ? bestDeparture(calls[0]) : null,
      arrive_ts: calls.length ? bestArrival(calls[0]) : null,
    });
  }

  // In transit. Where it came from: remembered first, geometry second.
  let prev = history && history.prev_stop ? history.prev_stop : '';
  if (prev === target) prev = '';
  if (!prev) prev = net.predecessorOf(target, train.route_id) || '';

  if (!prev || !net.stops.has(prev)) {
    // An origin terminal: the train has not started its run (136 of 658
    // sampled, every one unassigned). Waiting there is the honest depiction.
    return atStation(net, stop, target, calls, 'origin', {
      arrive_ts: calls.length ? bestArrival(calls[0]) : null,
    });
  }

  const [via, lengthM, resolution] = resolvePath(net, prev, target);
  if (!via.length) {
    return atStation(net, stop, target, calls, 'origin', { from_stop: prev });
  }

  const arrive = calls.length ? bestArrival(calls[0]) : null;
  const departed = history ? history.departed_ts : null;
  const window = timingWindow(lengthM, arrive, departed);

  let progress;
  let departTs = null;
  let arriveTs = null;
  if (window === null) {
    // No timing at all: hold it at the previous stop rather than guess.
    progress = 0.0;
  } else {
    [departTs, arriveTs] = window;
    const span = arriveTs - departTs;
    progress = span <= 0 ? 0.0 : (now - departTs) / span;
    progress = Math.min(Math.max(progress, 0.0), MAX_PROGRESS);
  }

  const cum = cumulative(via);
  const along = progress * cum[cum.length - 1];
  const [lon, lat, bearing] = interpolate(via, cum, along);
  const edge = segmentIndex(via, cum, along);
  return {
    lon,
    lat,
    bearing,
    progress,
    resolution,
    has_direction: true,
    offset_ref: via.length > 1 ? [via[edge], via[edge + 1]] : null,
    from_stop: prev,
    to_stop: target,
    depart_ts: departTs,
    arrive_ts: arriveTs,
    via,
  };
}
