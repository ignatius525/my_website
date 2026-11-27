// Load an exported network into the browser engine and build the drawn
// network from it, so a refresh that the engine cannot read is caught before
// it is committed. Used by .github/workflows/refresh-subway-data.yml.
//
//   node scripts/mta/check_network.mjs [src/subway/data/network.json]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const file = process.argv[2] || path.join(root, 'src/subway/data/network.json');
const { Network } = await import(path.join(root, 'src/subway/engine/network.js'));

const net = new Network(JSON.parse(fs.readFileSync(file, 'utf8')));
const display = net.buildDisplay(null);
const stations = net.stopsGeojson().features.length;
const routes = new Set(display.paths.map((p) => p.route_id));
const problems = [];
if (display.paths.length < 20) problems.push(`only ${display.paths.length} drawn paths`);
if (routes.size < 20) problems.push(`only ${routes.size} routes drawn`);
if (stations < 400) problems.push(`only ${stations} stations`);
if (!net.segment('A02S', 'A03S') && !net.findPath('A02S', 'A03S')) problems.push('no A train path at Inwood');
if (problems.length) {
  console.error(`engine check failed for ${file}:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(`engine check ok: GTFS ${net.version}, ${stations} stations, ${display.paths.length} drawn paths, ${routes.size} routes`);
