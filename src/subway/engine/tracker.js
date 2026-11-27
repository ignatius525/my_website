/*
 * Per-train memory across polls. Ported from fun-mta (mta_map/tracker.py).
 *
 * A TripUpdate lists only the stops *ahead* of a train, so the stop it most
 * recently left is never in its own update and has to be remembered. Trains
 * are keyed on the NYCT train_id, which was unique across all 658 sampled.
 */

import { TRAIN_EXPIRY } from './config.js';
import { bestDeparture, STOPPED_AT } from './gtfsrt.js';
import { pyInt } from './py.js';

export class Tracker {
  constructor() {
    this.history = new Map();
  }

  get size() { return this.history.size; }

  /**
   * Fold one observation into the train's history and return it. `target` is
   * the stop it is heading for, already normalised by the locator.
   */
  observe(train, target, now) {
    let hist = this.history.get(train.key);
    if (!hist) {
      hist = {
        key: train.key, target: '', target_departure: null, prev_stop: '',
        departed_ts: null, last_seen: 0.0, first_seen: now, last_stopped_ts: 0.0,
      };
      this.history.set(train.key, hist);
    }

    // The target moved on, so the train passed the stop it was heading for:
    // that stop becomes the previous stop, and the departure gets dated.
    // Predicted departures are often earlier than the real one (a train pinned
    // at a station then jumps ~2 km down an express run), but a STOPPED_AT
    // sighting at time t means it cannot have left before t, so take the later.
    if (hist.target && target && hist.target !== target) {
      hist.prev_stop = hist.target;
      const known = [
        hist.target_departure,
        hist.last_stopped_ts ? pyInt(hist.last_stopped_ts) : null,
      ].filter((c) => c);
      hist.departed_ts = known.length ? Math.max(...known) : pyInt(hist.last_seen || now);
    }

    // Sitting in a station is the strongest signal there is.
    if (train.current_status === STOPPED_AT && train.current_stop_id === target) {
      hist.prev_stop = target;
      hist.departed_ts = null;
      hist.last_stopped_ts = now;
    }

    hist.target = target;
    hist.target_departure = train.calls.length ? bestDeparture(train.calls[0]) : null;
    hist.last_seen = now;
    return hist;
  }

  /** Forget trains not seen recently. */
  expire(now) {
    for (const [k, h] of this.history) {
      if (now - h.last_seen > TRAIN_EXPIRY) this.history.delete(k);
    }
  }
}
