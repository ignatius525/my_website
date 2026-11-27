/*
 * The live map's "backend", in a Web Worker so the network rebuild (~0.1-0.3 s
 * when service changes) and the feed decoding never block the page.
 *
 * Protocol (all messages are plain objects):
 *   page -> worker  { type: 'poll' }         fetch the feeds and place trains
 *   worker -> page  { type: 'init', stops, routes, lines }
 *                   { type: 'snapshot', trains, health, lines? }
 *                     (`lines` only when the drawn network changed)
 *                   { type: 'error', message }
 * The page decides when to poll, so polling stops while the map is off-screen.
 */

import networkUrl from '../data/network.json?url';
import { Network } from './network.js';
import { Store } from './store.js';

let store = null;
let ready = null;
let sentVersion = null;
let polling = false;

async function init() {
  const resp = await fetch(networkUrl, { credentials: 'same-origin' });
  if (!resp.ok) throw new Error(`network data unavailable (HTTP ${resp.status})`);
  const net = new Network(await resp.json());
  store = new Store(net);
  const lines = store.linesPayload();
  sentVersion = lines.version;
  self.postMessage({
    type: 'init', stops: net.stopsGeojson(), routes: net.routesPayload(), lines,
  });
}

async function poll() {
  if (polling) return; // a slow poll is still running; skip rather than stack
  polling = true;
  try {
    await ready;
    await store.pollOnce();
    const now = Date.now() / 1000;
    const msg = { type: 'snapshot', trains: store.trainsPayload(now), health: store.healthPayload(now) };
    const lines = store.linesPayload();
    if (lines.version !== sentVersion) {
      msg.lines = lines;
      sentVersion = lines.version;
    }
    self.postMessage(msg);
  } catch (err) {
    self.postMessage({ type: 'error', message: String((err && err.message) || err) });
  } finally {
    polling = false;
  }
}

ready = init().catch((err) => {
  self.postMessage({ type: 'error', message: `startup failed: ${(err && err.message) || err}`, fatal: true });
  throw err;
});

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'poll') poll();
});
