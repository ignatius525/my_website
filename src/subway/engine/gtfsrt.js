/*
 * Minimal GTFS-realtime (+ NYCT extensions) decoder and feed parser.
 * Ported from fun-mta (mta_map/feeds.py).
 *
 * Hand-written rather than generated: protobuf libraries compile decoders at
 * runtime with `new Function`, which the site's CSP (script-src 'self', no
 * 'unsafe-eval') forbids. Only the handful of fields the map uses are read;
 * everything else is skipped by wire type. The input is third-party data, so
 * every read is bounds-checked and malformed input throws, which fails just
 * that one feed.
 *
 * Field numbers (gtfs-realtime.proto, nyct-subway.proto):
 *   FeedMessage   header=1 entity=2
 *   FeedHeader    gtfs_realtime_version=1 timestamp=3
 *   FeedEntity    trip_update=3 vehicle=4
 *   TripUpdate    trip=1 stop_time_update=2
 *   StopTimeUpdate arrival=2 departure=3 stop_id=4 [nyct_stop_time_update=1001]
 *   StopTimeEvent time=2
 *   VehiclePosition trip=1 current_status=4 timestamp=5 stop_id=7
 *   TripDescriptor trip_id=1 route_id=5 [nyct_trip_descriptor=1001]
 *   NyctTripDescriptor train_id=1 is_assigned=2 direction=3
 *   NyctStopTimeUpdate scheduled_track=1 actual_track=2
 */

// GTFS-RT VehicleStopStatus. The spec default is IN_TRANSIT_TO, which matters:
// 42% of live vehicles omit current_status entirely.
export const INCOMING_AT = 0;
export const STOPPED_AT = 1;
export const IN_TRANSIT_TO = 2;

const DIRECTION = { 1: 'N', 2: 'E', 3: 'S', 4: 'W' };

const utf8 = new TextDecoder('utf-8', { fatal: true });

class Reader {
  constructor(bytes, start = 0, end = bytes.length) {
    this.b = bytes;
    this.pos = start;
    this.end = end;
  }

  done() { return this.pos >= this.end; }

  byte() {
    if (this.pos >= this.end) throw new Error('truncated message');
    return this.b[this.pos++];
  }

  /** Unsigned varint as a Number (exact below 2^53, ample for timestamps). */
  varint() {
    let result = 0;
    let scale = 1;
    for (let i = 0; i < 10; i++) {
      const byte = this.byte();
      result += (byte & 0x7f) * scale;
      if (byte < 0x80) return result;
      scale *= 128;
    }
    throw new Error('malformed varint');
  }

  /** int64: a two's-complement varint; negative values come back negative. */
  int64() {
    const v = this.varint();
    return v >= 2 ** 63 ? v - 2 ** 64 : v;
  }

  sub() {
    const len = this.varint();
    if (len > this.end - this.pos) throw new Error('length past end of message');
    const r = new Reader(this.b, this.pos, this.pos + len);
    this.pos += len;
    return r;
  }

  string() {
    const r = this.sub();
    return utf8.decode(this.b.subarray(r.pos, r.end));
  }

  skip(wire, field) {
    switch (wire) {
      case 0: this.varint(); return;
      case 1: this.advance(8); return;
      case 2: this.sub(); return;
      case 5: this.advance(4); return;
      case 3: { // deprecated group: skip to its matching end tag
        for (;;) {
          const tag = this.varint();
          if ((tag & 7) === 4) {
            if (Math.floor(tag / 8) !== field) throw new Error('mismatched group end');
            return;
          }
          this.skip(tag & 7, Math.floor(tag / 8));
        }
      }
      default: throw new Error(`invalid wire type ${wire}`);
    }
  }

  advance(n) {
    if (n > this.end - this.pos) throw new Error('truncated message');
    this.pos += n;
  }

  /** Iterate fields: calls fn(field, wire) for each, which must consume or skip. */
  fields(fn) {
    while (!this.done()) {
      const tag = this.varint();
      const field = Math.floor(tag / 8);
      const wire = tag & 7;
      if (field === 0) throw new Error('field number 0');
      if (!fn(field, wire)) this.skip(wire, field);
    }
  }
}

/* Each decoder merges into `out`, matching protobuf's rule that a repeated
 * occurrence of a singular message field merges rather than replaces. */

function tripDescriptor(r, out = { trip_id: '', route_id: '', nyct: null }) {
  r.fields((f, w) => {
    if (f === 1 && w === 2) { out.trip_id = r.string(); return true; }
    if (f === 5 && w === 2) { out.route_id = r.string(); return true; }
    if (f === 1001 && w === 2) {
      out.nyct = nyctTrip(r.sub(), out.nyct || { train_id: '', is_assigned: false, direction: 0 });
      return true;
    }
    return false;
  });
  return out;
}

function nyctTrip(r, out) {
  r.fields((f, w) => {
    if (f === 1 && w === 2) { out.train_id = r.string(); return true; }
    if (f === 2 && w === 0) { out.is_assigned = r.varint() !== 0; return true; }
    if (f === 3 && w === 0) { out.direction = r.varint(); return true; }
    return false;
  });
  return out;
}

function stopTimeEvent(r, out = { time: 0 }) {
  r.fields((f, w) => {
    if (f === 2 && w === 0) { out.time = r.int64(); return true; }
    return false;
  });
  return out;
}

function stopTimeUpdate(r) {
  const out = {
    stop_id: '', arrival: null, departure: null, scheduled_track: '', actual_track: '',
  };
  r.fields((f, w) => {
    if (f === 4 && w === 2) { out.stop_id = r.string(); return true; }
    if (f === 2 && w === 2) { out.arrival = stopTimeEvent(r.sub(), out.arrival || undefined); return true; }
    if (f === 3 && w === 2) { out.departure = stopTimeEvent(r.sub(), out.departure || undefined); return true; }
    if (f === 1001 && w === 2) {
      const ext = r.sub();
      ext.fields((ef, ew) => {
        if (ef === 1 && ew === 2) { out.scheduled_track = ext.string(); return true; }
        if (ef === 2 && ew === 2) { out.actual_track = ext.string(); return true; }
        return false;
      });
      return true;
    }
    return false;
  });
  return out;
}

function tripUpdate(r, out = { trip: null, stop_time_update: [] }) {
  r.fields((f, w) => {
    if (f === 1 && w === 2) { out.trip = tripDescriptor(r.sub(), out.trip || undefined); return true; }
    if (f === 2 && w === 2) { out.stop_time_update.push(stopTimeUpdate(r.sub())); return true; }
    return false;
  });
  return out;
}

function vehiclePosition(r, out = {
  trip: null, current_status: null, timestamp: 0, stop_id: '',
}) {
  r.fields((f, w) => {
    if (f === 1 && w === 2) { out.trip = tripDescriptor(r.sub(), out.trip || undefined); return true; }
    if (f === 4 && w === 0) {
      // proto2 enums are closed: an unknown value is dropped, not stored, so
      // the field then reads as absent (and defaults to IN_TRANSIT_TO).
      const v = r.varint();
      if (v === INCOMING_AT || v === STOPPED_AT || v === IN_TRANSIT_TO) out.current_status = v;
      return true;
    }
    if (f === 5 && w === 0) { out.timestamp = r.varint(); return true; }
    if (f === 7 && w === 2) { out.stop_id = r.string(); return true; }
    return false;
  });
  return out;
}

/** Decode a FeedMessage, keeping only what the map needs. */
export function decodeFeed(bytes) {
  const r = new Reader(bytes);
  const header = { gtfs_realtime_version: '', timestamp: 0 };
  const entities = [];
  r.fields((f, w) => {
    if (f === 1 && w === 2) {
      const h = r.sub();
      h.fields((hf, hw) => {
        if (hf === 1 && hw === 2) { header.gtfs_realtime_version = h.string(); return true; }
        if (hf === 3 && hw === 0) { header.timestamp = h.varint(); return true; }
        return false;
      });
      return true;
    }
    if (f === 2 && w === 2) {
      const e = r.sub();
      const entity = { trip_update: null, vehicle: null };
      e.fields((ef, ew) => {
        if (ef === 3 && ew === 2) { entity.trip_update = tripUpdate(e.sub(), entity.trip_update || undefined); return true; }
        if (ef === 4 && ew === 2) { entity.vehicle = vehiclePosition(e.sub(), entity.vehicle || undefined); return true; }
        return false;
      });
      entities.push(entity);
      return true;
    }
    return false;
  });
  return { header, entities };
}

/** Best-effort description of a payload that would not decode. */
function describeBody(bytes) {
  let start = 0;
  while (start < bytes.length && bytes[start] <= 0x20) start++;
  const first = bytes[start];
  if (first === 0x3c || first === 0x7b) { // '<' or '{'
    const text = new TextDecoder('utf-8').decode(bytes.subarray(start, start + 400));
    const code = /<Code>([^<]+)<\/Code>/.exec(text);
    if (code) return `S3 error document: ${code[1].slice(0, 80)}`;
    const message = /"message"\s*:\s*"([^"]+)"/.exec(text);
    if (message) return `API error document: ${message[1].slice(0, 80)}`;
    return 'error document';
  }
  return `${bytes.length} bytes`;
}

/**
 * Decode one feed into train records. A train needs both a VehiclePosition
 * (where it is) and a TripUpdate (where it is going); they arrive as separate
 * entities keyed by trip_id.
 *
 * Decode first, then inspect: a valid feed can begin with bytes that look like
 * JSON (nyct%2Fgtfs starts with "\n{"), so sniffing first would reject it. A
 * decode is only trusted if it carries gtfs_realtime_version.
 */
export function parseFeed(bytes, feedId) {
  if (!bytes || !bytes.length) throw new Error(`${feedId}: empty response`);
  let msg;
  try {
    msg = decodeFeed(bytes);
  } catch (err) {
    throw new Error(`${feedId}: not a GTFS-RT feed (${describeBody(bytes)})`);
  }
  if (!msg.header.gtfs_realtime_version) {
    throw new Error(`${feedId}: decoded but no GTFS-RT header (${describeBody(bytes)})`);
  }

  const updates = new Map();
  const vehicles = new Map();
  for (const entity of msg.entities) {
    if (entity.trip_update) updates.set((entity.trip_update.trip || {}).trip_id || '', entity.trip_update);
    if (entity.vehicle) vehicles.set((entity.vehicle.trip || {}).trip_id || '', entity.vehicle);
  }

  const headerTs = msg.header.timestamp;
  const trains = [];
  for (const [tripId, vehicle] of vehicles) {
    const trip = vehicle.trip || { trip_id: '', route_id: '', nyct: null };
    const ext = trip.nyct || { train_id: '', is_assigned: false, direction: 0 };

    const calls = [];
    const update = updates.get(tripId);
    if (update) {
      for (const stu of update.stop_time_update) {
        calls.push({
          stop_id: stu.stop_id,
          arrival: (stu.arrival && stu.arrival.time) || null,
          departure: (stu.departure && stu.departure.time) || null,
          scheduled_track: stu.scheduled_track,
          actual_track: stu.actual_track,
        });
      }
    }

    // Direction from the stop_id suffix, not the NYCT field: the extension
    // omits direction on 50% of vehicles, the suffix never does.
    const refStop = vehicle.stop_id || (calls.length ? calls[0].stop_id : '');
    const last = refStop.slice(-1);
    const direction = (last === 'N' || last === 'S') ? last : (DIRECTION[ext.direction] || '');

    trains.push({
      key: ext.train_id || `${trip.route_id}:${tripId}`,
      train_id: ext.train_id,
      trip_id: tripId,
      route_id: trip.route_id,
      direction,
      is_assigned: Boolean(ext.is_assigned),
      feed_id: feedId,
      feed_timestamp: headerTs,
      vehicle_timestamp: vehicle.timestamp || headerTs,
      // Absent on 42% of vehicles; the GTFS-RT default is IN_TRANSIT_TO.
      current_status: vehicle.current_status ?? IN_TRANSIT_TO,
      current_stop_id: vehicle.stop_id,
      calls,
    });
  }
  return { timestamp: headerTs, trains };
}

export const bestArrival = (call) => (call.arrival != null ? call.arrival : call.departure);
export const bestDeparture = (call) => (call.departure != null ? call.departure : call.arrival);
