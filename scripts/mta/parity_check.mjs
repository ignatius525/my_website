// Parity check: replays recorded MTA feeds through the browser engine
// (src/subway/engine) and diffs every train and drawn line against the
// original Python's output from parity_reference.py.
//
//   python scripts/mta/parity_reference.py ref.json <snapshot dirs...>
//   node scripts/mta/parity_check.mjs ref.json src/subway/data/network.json <snapshot dirs...>
//
// A snapshot dir holds the eight feeds as nyct_gtfs*.pb plus captured_at.json
// ({"wall": unix seconds}), like fun-mta's tests/fixtures/pair/a and b.
// Geometry must match exactly; train numbers to within Python's output rounding.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ENGINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src/subway/engine') + '/';
const { Network } = await import(ENGINE + 'network.js');
const { Store } = await import(ENGINE + 'store.js');
const { parseFeed } = await import(ENGINE + 'gtfsrt.js');
const { SUBWAY_FEEDS } = await import(ENGINE + 'config.js');

const [pyPath, netPath, ...dirs] = process.argv.slice(2);
const py = JSON.parse(fs.readFileSync(pyPath, 'utf8'));
const net = new Network(JSON.parse(fs.readFileSync(netPath, 'utf8')));
const store = new Store(net);

let fails = 0;
const report = (msg) => { if (fails++ < 40) console.log('DIFF', msg); };
const close = (a, b, tol) => (a == null && b == null) || (a != null && b != null && Math.abs(a - b) <= tol);

function cmpLines(label, jsDisplay, pyLines) {
  const js = jsDisplay.paths;
  if (js.length !== pyLines.length) report(`${label}: ${js.length} paths vs ${pyLines.length}`);
  let maxOff = 0, maxPt = 0;
  for (let i = 0; i < Math.min(js.length, pyLines.length); i++) {
    const a = js[i], b = pyLines[i];
    if (a.route_id !== b.route_id || a.via.length !== b.via.length) { report(`${label} path ${i}: ${a.route_id}/${a.via.length} vs ${b.route_id}/${b.via.length}`); continue; }
    for (let k = 0; k < a.via.length; k++) {
      maxPt = Math.max(maxPt, Math.abs(a.via[k][0] - b.via[k][0]), Math.abs(a.via[k][1] - b.via[k][1]));
      maxOff = Math.max(maxOff, Math.abs(a.offsets[k] - b.offsets[k]));
    }
  }
  console.log(`${label}: ${js.length} paths, max vertex diff ${maxPt}, max offset diff ${maxOff}`);
  if (maxPt > 0 || maxOff > 1e-9) report(`${label}: geometry differs`);
}

cmpLines('scheduled', store.display, py.scheduled);

const stopsJs = net.stopsGeojson().features.map((f) => f.properties);
if (JSON.stringify(stopsJs.map((s) => [s.stop_id, s.routes])) !== JSON.stringify(py.stops.map((s) => [s.stop_id, s.routes]))) report('stops geojson differs');

dirs.forEach((dir, step) => {
  const wall = JSON.parse(fs.readFileSync(path.join(dir, 'captured_at.json'), 'utf8')).wall;
  const results = Object.keys(SUBWAY_FEEDS).map((fid) => {
    const f = path.join(dir, fid.replace('%2F', '_') + '.pb');
    if (!fs.existsSync(f)) return { feed_id: fid, ok: false, error: 'missing', trains: [], fetched_at: wall };
    const { timestamp, trains } = parseFeed(new Uint8Array(fs.readFileSync(f)), fid);
    return { feed_id: fid, ok: true, timestamp, trains, fetched_at: wall };
  });
  store.ingest(results, wall);
  const ref = py.steps[step];
  cmpLines(`step ${step} lines`, store.snapshot.display, ref.lines);
  const feats = store.trainsPayload(wall).features;
  console.log(`step ${step}: ${feats.length} trains (py ${ref.trains.length}), counts ${JSON.stringify(store.snapshot.resolution_counts)} vs ${JSON.stringify(ref.counts)}`);
  if (feats.length !== ref.trains.length) report(`step ${step}: train count`);
  let worst = { pos: 0, bearing: 0, offset: 0, progress: 0, via: 0 };
  for (let i = 0; i < Math.min(feats.length, ref.trains.length); i++) {
    const a = feats[i], b = ref.trains[i];
    const p = a.properties, q = b.properties;
    for (const k of ['key', 'train_id', 'route_id', 'line', 'route_color', 'route_text_color', 'direction', 'is_assigned', 'status', 'has_direction', 'shared', 'resolution', 'next_stop', 'next_stop_name', 'eta_seconds', 'terminus', 'actual_track', 'feed_timestamp']) {
      if (p[k] !== q[k]) report(`step ${step} train ${q.key} ${k}: ${JSON.stringify(p[k])} vs ${JSON.stringify(q[k])}`);
    }
    worst.pos = Math.max(worst.pos, Math.abs(a.geometry.coordinates[0] - b.geometry.coordinates[0]), Math.abs(a.geometry.coordinates[1] - b.geometry.coordinates[1]));
    let db = Math.abs(p.bearing - q.bearing); db = Math.min(db, 360 - db);
    worst.bearing = Math.max(worst.bearing, db);
    worst.offset = Math.max(worst.offset, Math.abs(p.offset - q.offset));
    worst.progress = Math.max(worst.progress, Math.abs(p.progress - q.progress));
    if (!close(p.offset_bearing, q.offset_bearing, 0.15)) report(`step ${step} train ${q.key} offset_bearing ${p.offset_bearing} vs ${q.offset_bearing}`);
    if (p.motion.depart_ts !== q.motion.depart_ts || p.motion.arrive_ts !== q.motion.arrive_ts) report(`step ${step} train ${q.key} motion ts ${p.motion.depart_ts},${p.motion.arrive_ts} vs ${q.motion.depart_ts},${q.motion.arrive_ts}`);
    if (p.motion.via.length !== q.motion.via.length) report(`step ${step} train ${q.key} via len ${p.motion.via.length} vs ${q.motion.via.length}`);
    else for (let k = 0; k < p.motion.via.length; k++) worst.via = Math.max(worst.via, Math.abs(p.motion.via[k][0] - q.motion.via[k][0]), Math.abs(p.motion.via[k][1] - q.motion.via[k][1]));
  }
  console.log(`step ${step} worst: ${JSON.stringify(worst)}`);
  // Python rounds lon/lat to 6 dp, bearing to 1 dp, offset_bearing to 1 dp, progress to 4 dp.
  if (worst.pos > 6e-7 || worst.bearing > 0.06 || worst.offset > 1e-9 || worst.progress > 6e-5 || worst.via > 6e-7) report(`step ${step}: numeric drift beyond output rounding`);
});
console.log(fails ? `FAIL: ${fails} differences` : 'PARITY OK');
process.exit(fails ? 1 : 0);
