/*
 * The live subway map: MapLibre plus 1 Hz dead reckoning.
 * Ported from fun-mta's web/app.js; the engine Web Worker stands in for its
 * FastAPI backend, and the pasture theme replaces Night City.
 *
 * The worker hands every train a motion vector -- the polyline it is on and
 * when it departs and arrives -- so the map animates once a second off a
 * single poll a minute, which is also how often the MTA feeds update.
 *
 * Security: train fields come from a third-party feed, so popups and the
 * legend are built with DOM nodes and textContent, never HTML strings.
 */

import {
  FullscreenControl, Map as MapLibreMap, NavigationControl, Popup, setWorkerUrl,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';

import { POLL_INTERVAL_MS } from '../engine/config.js';
import landmarkList from '../data/landmarks.json';
import {
  makeArrowImage, makeBracketImage, makeDiamondSDF, makeSheepImage,
} from './icons.js';
import { basemapStyle, theme } from './theme.js';

// MapLibre's own worker, served from this origin as a module: without this it
// falls back to a blob: URL, which the CSP (worker-src 'self') does not allow.
// vite.config.js emits it as .js, not .mjs, so it is served with a JavaScript
// MIME type (module workers require one, and nosniff is on).
setWorkerUrl(maplibreWorkerUrl);

const zoomRamp = (stops) => ['interpolate', ['linear'], ['zoom'], ...stops.flat()];

/** Evaluate a [[zoom, value], ...] ramp at zoom `z`, for values our code consumes. */
function rampAt(stops, z) {
  if (z <= stops[0][0]) return stops[0][1];
  const last = stops[stops.length - 1];
  if (z >= last[0]) return last[1];
  for (let i = 1; i < stops.length; i++) {
    if (z <= stops[i][0]) {
      const [z0, v0] = stops[i - 1];
      const [z1, v1] = stops[i];
      return v0 + ((v1 - v0) * (z - z0)) / (z1 - z0);
    }
  }
  return last[1];
}

/* ---------------------------------------------- parallel line geometry --- */

/*
 * Offset a route's polyline sideways, per vertex, in screen pixels.
 *
 * MapLibre's line-offset takes one value per feature, so a route sharing track
 * with different neighbours along its length would need a feature per
 * stretch, and those cannot meet across the sideways step where a bundle
 * changes. Offsetting the geometry keeps each route one unbroken line that
 * eases between slots. The mitre is capped, and a vertex whose segment ends up
 * reversed (the shift exceeded the curve's radius) is dropped as a knot --
 * ignoring sub-pixel segments, where the test only measures rounding noise.
 */
const MITRE_LIMIT = 1.6;

function offsetGeometry(map, coords, offsets, spacing) {
  const n = coords.length;
  if (n < 2) return coords;
  const px = coords.map((c) => { const p = map.project(c); return [p.x, p.y]; });
  const normals = [];
  for (let i = 0; i < n - 1; i++) {
    const dx = px[i + 1][0] - px[i][0];
    const dy = px[i + 1][1] - px[i][1];
    const len = Math.hypot(dx, dy) || 1;
    normals.push([-dy / len, dx / len]);
  }
  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    let nx;
    let ny;
    if (i === 0) [nx, ny] = normals[0];
    else if (i === n - 1) [nx, ny] = normals[n - 2];
    else {
      const [ax, ay] = normals[i - 1];
      const [bx, by] = normals[i];
      nx = ax + bx;
      ny = ay + by;
      const len = Math.hypot(nx, ny) || 1;
      nx /= len;
      ny /= len;
      const cosHalf = Math.max(1 / MITRE_LIMIT, nx * ax + ny * ay);
      nx /= cosHalf;
      ny /= cosHalf;
    }
    const shift = (offsets[i] || 0) * spacing;
    out[i] = [px[i][0] + nx * shift, px[i][1] + ny * shift];
  }
  const keep = new Array(n).fill(true);
  for (let i = 0; i < n - 1; i++) {
    const odx = px[i + 1][0] - px[i][0];
    const ody = px[i + 1][1] - px[i][1];
    const olen = Math.hypot(odx, ody);
    if (olen < 0.75) continue;
    const ndx = out[i + 1][0] - out[i][0];
    const ndy = out[i + 1][1] - out[i][1];
    const nlen = Math.hypot(ndx, ndy);
    if (nlen === 0) continue;
    if ((odx * ndx + ody * ndy) / (olen * nlen) < -0.2) keep[i === 0 ? 1 : i] = false;
  }
  keep[0] = true;
  keep[n - 1] = true;
  const result = [];
  for (let i = 0; i < n; i++) {
    if (!keep[i]) continue;
    const ll = map.unproject(out[i]);
    result.push([ll.lng, ll.lat]);
  }
  return result;
}

/* ----------------------------------------------------------- animation --- */

function pointAt(train, frac) {
  const { via, cum } = train;
  if (!via || !via.length) return null;
  if (via.length === 1) return via[0];
  const target = frac * cum[cum.length - 1];
  // Trains only move forward between polls, so resume the scan.
  let i = train.seg || 0;
  if (cum[i] > target) i = 0;
  while (i < cum.length - 2 && cum[i + 1] < target) i++;
  train.seg = i;
  const span = cum[i + 1] - cum[i];
  const t = span <= 0 ? 0 : (target - cum[i]) / span;
  return [via[i][0] + t * (via[i + 1][0] - via[i][0]), via[i][1] + t * (via[i + 1][1] - via[i][1])];
}

function progressOf(train, t) {
  const { depart_ts: d, arrive_ts: a } = train;
  if (d == null || a == null || a <= d) return train.progress || 0;
  return Math.min(Math.max((t - d) / (a - d), 0), 0.98); // the engine's MAX_PROGRESS
}

/* Shift a train onto its own line within a fanned-out corridor, along the
 * bearing the *line* was drawn in (not the train's heading, which would put a
 * southbound train on its neighbour's colour). */
function applyParallelOffset(map, coords, tr, spacing) {
  if (!spacing || !tr.offset || tr.offsetBearing == null) return coords;
  const p = map.project(coords);
  const rad = (tr.offsetBearing * Math.PI) / 180;
  const shift = tr.offset * spacing;
  const moved = map.unproject([p.x + shift * Math.cos(rad), p.y + shift * Math.sin(rad)]);
  return [moved.lng, moved.lat];
}

const KX_RATIO = Math.cos((40.73 * Math.PI) / 180);
// Trains whose route has no colour of their own (a route new since the export).
const FALLBACK_COLOUR = '#6D6E71';

/* ----------------------------------------------------------- controller -- */

export class SubwayMapController {
  /**
   * @param {HTMLElement} container  element MapLibre renders into
   * @param {HTMLElement} fullscreenTarget  element taken fullscreen (map + HUD)
   * @param {(state: object) => void} onUpdate  HUD/legend state, ~1 Hz
   */
  constructor({ container, fullscreenTarget, onUpdate }) {
    this.container = container;
    this.fullscreenTarget = fullscreenTarget;
    this.onUpdate = onUpdate;
    this.trains = [];
    this.linePaths = null;
    this.routes = null;
    this.hidden = new Set();
    this.allRoutes = [];
    this.legend = [];
    this.health = null;
    this.lastUpdate = 0;
    this.error = '';
    this.active = false;
    this.ready = false;
    this.destroyed = false;
    this.lastPoll = 0;
    // Seconds to add to Date.now() to match the feeds' clock (from the worker).
    this.clockOffset = 0;
    this.sheepColours = new Set();
    // Under reduced motion, trains are redrawn once per poll instead of
    // creeping along every second.
    this.tickMs = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? POLL_INTERVAL_MS : theme.animation.tickMs;
  }

  now() { return Date.now() / 1000 + this.clockOffset; }

  /** Create the map and the engine. Resolves once the first data is drawn. */
  async start() {
    const th = theme;
    let map;
    try {
      map = this.createMap(th);
    } catch (err) {
      // MapLibre throws here when WebGL 2 is unavailable.
      throw Object.assign(err instanceof Error ? err : new Error(String(err)), { webgl: true });
    }
    this.map = map;
    map.touchZoomRotate.disableRotation();
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    const fs = new FullscreenControl({ container: this.fullscreenTarget });
    map.addControl(fs, 'top-right');
    fs.on('fullscreenstart', () => map.cooperativeGestures.disable());
    fs.on('fullscreenend', () => map.cooperativeGestures.enable());
    map.on('error', (e) => console.warn('map:', e && e.error ? e.error.message : e));
    return this.startEngine(map);
  }

  createMap(th) {
    return new MapLibreMap({
      container: this.container,
      style: basemapStyle,
      center: th.basemap.center,
      zoom: th.basemap.zoom,
      minZoom: th.basemap.minZoom,
      maxZoom: th.basemap.maxZoom,
      maxBounds: th.basemap.maxBounds,
      // Ctrl/Cmd + scroll to zoom and two fingers to pan, so the page still
      // scrolls past the map. Turned off while fullscreen.
      cooperativeGestures: true,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      renderWorldCopies: false,
      maplibreLogo: false,
      attributionControl: { compact: true, customAttribution: 'Train data: MTA' },
      // One device pixel per CSS pixel, upscaled crisp (see .subway-map in
      // index.css): a touch of the site's pixel look, and cheaper to draw.
      pixelRatio: Math.min(window.devicePixelRatio || 1, 1),
    });
  }

  async startEngine(map) {
    const worker = new Worker(new URL('../engine/worker.js', import.meta.url), { type: 'module' });
    this.worker = worker;
    const init = new Promise((resolve, reject) => {
      worker.addEventListener('message', (e) => {
        const msg = e.data || {};
        if (msg.type === 'init') resolve(msg);
        else if (msg.type === 'snapshot') this.onSnapshot(msg);
        else if (msg.type === 'error') {
          this.setError(msg.message);
          if (msg.fatal) reject(new Error(msg.message));
        }
      });
      worker.addEventListener('error', (e) => reject(new Error(e.message || 'engine failed to start')));
    });

    const [data] = await Promise.all([
      init,
      map.loaded() ? null : new Promise((res) => { map.once('load', res); }),
    ]);
    if (this.destroyed) return;
    this.routes = data.routes;
    this.addLayers(data);
    this.linePaths = data.lines.features;
    this.buildLegend();
    this.rebuildLines();
    this.applyRouteVisibility();
    map.on('zoomend', () => { this.rebuildLines(); this.tick(); });
    this.ready = true;
    this.setActive(this.active);
  }

  /** Run (poll + animate) only while the map is on screen and the tab visible. */
  setActive(active) {
    this.active = active;
    if (!this.ready || this.destroyed) return;
    clearInterval(this.tickTimer);
    clearInterval(this.pollTimer);
    clearTimeout(this.pollKick);
    if (!active) return;
    const since = Date.now() - this.lastPoll;
    const firstIn = since >= POLL_INTERVAL_MS ? 0 : POLL_INTERVAL_MS - since;
    this.pollKick = setTimeout(() => {
      this.poll();
      this.pollTimer = setInterval(() => this.poll(), POLL_INTERVAL_MS);
    }, firstIn);
    this.tick();
    this.tickTimer = setInterval(() => this.tick(), this.tickMs);
  }

  poll() {
    this.lastPoll = Date.now();
    this.worker.postMessage({ type: 'poll' });
  }

  destroy() {
    this.destroyed = true;
    clearInterval(this.tickTimer);
    clearInterval(this.pollTimer);
    clearTimeout(this.pollKick);
    if (this.popup) this.popup.remove();
    if (this.worker) this.worker.terminate();
    if (this.map) this.map.remove();
  }

  setError(message) {
    this.error = message || '';
    if (message) console.warn('subway:', message);
    this.emit();
  }

  /* ---------------------------------------------------------- data --- */

  onSnapshot(msg) {
    if (this.destroyed) return;
    if (msg.lines) {
      this.linePaths = msg.lines.features;
      this.rebuildLines();
    }
    this.clockOffset = Number(msg.clockOffset) || 0;
    this.enrich(msg.trains);
    this.health = msg.health;
    this.error = msg.health.ok ? '' : 'Some MTA feeds are failing right now.';
    this.tick();
  }

  /** Flatten the trains payload into what the animation loop wants. */
  enrich(payload) {
    this.lastUpdate = payload.updated_at;
    this.trains = payload.features.map((f) => {
      const p = f.properties;
      const via = p.motion && p.motion.via && p.motion.via.length ? p.motion.via : [f.geometry.coordinates];
      const cum = [0];
      for (let i = 1; i < via.length; i++) {
        const dx = (via[i][0] - via[i - 1][0]) * KX_RATIO;
        const dy = via[i][1] - via[i - 1][1];
        cum.push(cum[i - 1] + Math.hypot(dx, dy));
      }
      // By display route, so a 6X sheep wears the 6's colour, like its line.
      let color = this.routeColor(p.line || p.route_id) || p.route_color;
      if (!this.sheepColours.has(color)) color = FALLBACK_COLOUR;
      return {
        via, cum, seg: 0,
        offset: p.offset || 0,
        offsetBearing: p.offset_bearing,
        depart_ts: p.motion ? p.motion.depart_ts : null,
        arrive_ts: p.motion ? p.motion.arrive_ts : null,
        progress: p.progress,
        props: {
          key: p.key,
          route_id: p.route_id,
          line: p.line || p.route_id,
          color,
          // Sheep face their direction of travel: east-ish right, west-ish left.
          icon: `sheep-${color}-${p.has_direction && p.bearing > 180 ? 'l' : 'r'}`,
          direction: p.direction,
          is_assigned: p.is_assigned,
          next_stop_name: p.next_stop_name,
          bearing: p.bearing,
          has_direction: p.has_direction,
          shared: p.shared || 1,
          eta_seconds: p.eta_seconds,
          terminus: p.terminus,
          resolution: p.resolution,
          actual_track: p.actual_track,
          train_id: p.train_id,
        },
      };
    });
  }

  routeColor(routeId) {
    // hasOwn: route ids come from the feed, and "constructor" must not
    // resolve to Object.prototype.constructor.
    const over = theme.lines.colorOverrides;
    if (Object.hasOwn(over, routeId)) return over[routeId];
    const r = this.routes && Object.hasOwn(this.routes, routeId) ? this.routes[routeId] : null;
    return r ? r.color : null;
  }

  /** Rebuild the train GeoJSON for the current instant. */
  tick() {
    const { map } = this;
    if (!map || !this.ready) return;
    const t = this.now();
    const spacing = rampAt(theme.lines.parallel.spacing, map.getZoom());
    const features = new Array(this.trains.length);
    for (let i = 0; i < this.trains.length; i++) {
      const tr = this.trains[i];
      let pt = pointAt(tr, progressOf(tr, t)) || tr.via[0];
      pt = applyParallelOffset(map, pt, tr, spacing);
      features[i] = { type: 'Feature', geometry: { type: 'Point', coordinates: pt }, properties: tr.props };
      // An open popup follows its train.
      if (this.popup && this.popupKey === tr.props.key) this.popup.setLngLat(pt);
    }
    const src = map.getSource('trains');
    if (src) src.setData({ type: 'FeatureCollection', features });
    this.emit();
  }

  /** Recompute every line's offset geometry for the current zoom. */
  rebuildLines() {
    const { map } = this;
    if (!map || !this.linePaths) return;
    const spacing = rampAt(theme.lines.parallel.spacing, map.getZoom());
    const features = this.linePaths.map((f) => {
      const coords = f.geometry.coordinates;
      const { offsets } = f.properties;
      const usable = Array.isArray(offsets) && offsets.length === coords.length;
      return {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: usable ? offsetGeometry(map, coords, offsets, spacing) : coords },
        properties: { route_id: f.properties.route_id },
      };
    });
    const src = map.getSource('network');
    if (src) src.setData({ type: 'FeatureCollection', features });
  }

  /* ------------------------------------------------------- HUD state --- */

  emit() {
    if (!this.onUpdate) return;
    const shown = this.hidden.size
      ? this.trains.filter((t) => !this.hidden.has(t.props.line)).length
      : this.trains.length;
    this.onUpdate({
      ready: this.ready,
      total: this.trains.length,
      shown,
      ageSeconds: this.lastUpdate ? Math.max(0, Math.round(this.now() - this.lastUpdate)) : null,
      feeds: this.health ? this.health.feeds.map((f) => ({
        id: f.feed_id,
        label: f.feed_id.replace('nyct%2Fgtfs', '').replace(/^-/, '').toUpperCase() || '1-7',
        ok: f.ok,
        stale: f.stale,
        error: f.error,
      })) : [],
      legend: this.legend.map((b) => ({
        ...b, off: b.routes.every((r) => this.hidden.has(r)),
      })),
      error: this.error,
    });
  }

  /* ---------------------------------------------------------- legend --- */

  /** One badge per distinct bullet, in MTA's route_sort_order (express variants folded in). */
  buildLegend() {
    const routes = this.routes;
    const order = Object.keys(routes)
      .filter((r) => !(r.endsWith('X') && routes[r.slice(0, -1)]))
      .sort((a, b) => (routes[a].sort_order ?? 9999) - (routes[b].sort_order ?? 9999));
    const seen = new Map();
    for (const r of order) {
      const badge = routes[r].short_name || r;
      const colour = this.routeColor(r);
      const k = `${badge}|${colour}`;
      if (seen.has(k)) {
        seen.get(k).names.push(routes[r].long_name);
        seen.get(k).routes.push(r);
      } else {
        seen.set(k, { badge, colour, text: routes[r].text_color, names: [routes[r].long_name], routes: [r] });
      }
    }
    this.legend = [...seen.values()];
    this.allRoutes = this.legend.flatMap((b) => b.routes);
  }

  /*
   * Solo-select, not a plain toggle:
   *   everything shown -> show only this one; a hidden one -> add it;
   *   a shown one -> drop it; the only one shown -> back to everything.
   * Clicking the same badge twice always returns to where you started.
   */
  legendClick(ids) {
    const all = this.allRoutes;
    const group = new Set(ids);
    const visible = all.filter((r) => !this.hidden.has(r));
    const groupShown = ids.every((r) => !this.hidden.has(r));
    if (visible.length === all.length) this.hidden = new Set(all.filter((r) => !group.has(r)));
    else if (!groupShown) for (const r of ids) this.hidden.delete(r);
    else if (visible.length === group.size) this.hidden = new Set();
    else for (const r of ids) this.hidden.add(r);
    this.applyRouteVisibility();
    this.emit();
  }

  /* Fade hidden routes' lines, stop drawing their trains, and dim stations
   * once every route calling there is hidden. Polling carries on, so a route
   * switched back on shows where its trains are now. */
  applyRouteVisibility() {
    const { map } = this;
    if (!map) return;
    const off = [...this.hidden];
    const dim = theme.lines.hiddenOpacity;
    const fade = (base) => (off.length ? ['case', ['in', ['get', 'route_id'], ['literal', off]], dim * base, base] : base);
    map.setPaintProperty('lines', 'line-opacity', fade(theme.lines.opacity));
    map.setPaintProperty('lines-casing', 'line-opacity', fade(theme.lines.casingOpacity));

    const trainFilter = off.length ? ['!', ['in', ['get', 'line'], ['literal', off]]] : null;
    map.setFilter('trains', trainFilter);
    map.setFilter('train-labels', trainFilter);
    map.setFilter('train-arrows', trainFilter
      ? ['all', ['==', ['get', 'has_direction'], true], trainFilter]
      : ['==', ['get', 'has_direction'], true]);

    const st = theme.stations;
    const visible = this.allRoutes.filter((r) => !this.hidden.has(r));
    const served = off.length ? ['any', ...visible.map((r) => ['in', r, ['get', 'routes']])] : true;
    const at = (base) => (off.length ? ['case', served, base, base * st.hiddenOpacity] : base);
    map.setPaintProperty('stops', 'icon-opacity', at(st.opacity));
    map.setPaintProperty('stop-labels', 'text-opacity', at(st.labels.opacity));
  }

  /* ---------------------------------------------------------- layers --- */

  addLayers({ stops }) {
    const { map } = this;
    const th = theme;
    const fontRegular = th.basemap.fonts.regular;
    const fontBold = th.basemap.fonts.bold;

    const colorExpr = ['match', ['get', 'route_id']];
    const colours = new Set();
    for (const rid of Object.keys(this.routes)) {
      const c = this.routeColor(rid);
      colorExpr.push(rid, c);
      colours.add(c);
    }
    colorExpr.push(FALLBACK_COLOUR);
    colours.add(FALLBACK_COLOUR);

    map.addSource('network', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addLayer({
      id: 'lines-casing', type: 'line', source: 'network',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': th.lines.casingColor,
        'line-opacity': th.lines.casingOpacity,
        'line-width': zoomRamp(th.lines.casingWidth),
      },
    });
    map.addLayer({
      id: 'lines', type: 'line', source: 'network',
      layout: { 'line-join': th.lines.join, 'line-cap': th.lines.cap },
      paint: { 'line-color': colorExpr, 'line-opacity': th.lines.opacity, 'line-width': zoomRamp(th.lines.width) },
    });

    // Landmarks before stations: MapLibre places symbols in reverse layer
    // order, so the later layer wins collisions and station names survive
    // (with landmarks last, only 8 of 34 Midtown station labels did).
    this.addLandmarks(fontRegular);

    map.addSource('stops', { type: 'geojson', data: stops });
    const st = th.stations;
    map.addImage('station-bracket', makeBracketImage(48, {
      color: st.color, thickness: st.bracket.thickness, gap: st.bracket.gap,
    }), { pixelRatio: 2 });
    map.addLayer({
      id: 'stops', type: 'symbol', source: 'stops', minzoom: st.minZoom,
      layout: {
        'icon-image': 'station-bracket',
        'icon-size': zoomRamp(st.bracket.size),
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
      paint: { 'icon-opacity': st.opacity },
    });
    map.addLayer({
      id: 'stop-labels', type: 'symbol', source: 'stops', minzoom: st.labels.minZoom,
      layout: {
        'text-field': st.labels.uppercase ? ['upcase', ['get', 'name']] : ['get', 'name'],
        'text-font': fontRegular,
        'text-size': st.labels.size,
        'text-letter-spacing': st.labels.letterSpacing,
        'text-offset': [0, 1.2],
        'text-anchor': 'top',
      },
      paint: {
        'text-color': st.labels.color,
        'text-halo-color': st.labels.haloColor,
        'text-halo-width': 1.4,
        'text-opacity': st.labels.opacity,
      },
    });

    map.addSource('trains', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    const tr = th.trains;

    // The arrow sits under the sheep, rotated to the bearing; trains whose
    // heading is unknown get none rather than one pointing due north.
    map.addImage('train-arrow', makeArrowImage(tr.arrow.pixels, tr.arrow), { pixelRatio: 2 });
    map.addLayer({
      id: 'train-arrows', type: 'symbol', source: 'trains', minzoom: tr.arrow.minZoom,
      filter: ['==', ['get', 'has_direction'], true],
      layout: {
        'icon-image': 'train-arrow',
        'icon-rotate': ['get', 'bearing'],
        'icon-rotation-alignment': 'map',
        'icon-size': zoomRamp(tr.arrow.size),
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
      paint: {
        'icon-opacity': ['case', ['get', 'is_assigned'], tr.arrow.opacity, tr.arrow.unassignedOpacity],
      },
    });

    for (const colour of colours) {
      this.sheepColours.add(colour);
      for (const facing of ['r', 'l']) {
        map.addImage(`sheep-${colour}-${facing}`,
          makeSheepImage(colour, tr.outline, facing === 'l' ? 'left' : 'right'), { pixelRatio: 2 });
      }
    }
    map.addLayer({
      id: 'trains', type: 'symbol', source: 'trains',
      layout: {
        'icon-image': ['get', 'icon'],
        'icon-size': zoomRamp(tr.size),
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        // Assigned trains draw over the dimmed, not-yet-assigned ones.
        'symbol-sort-key': ['case', ['get', 'is_assigned'], 1, 0],
      },
      paint: {
        // A third of trains are scheduled trips not yet tied to a physical
        // train. Every one with an implausible timing ratio was in this group
        // (70 of 70), so dimming them dims exactly what cannot be pinned down.
        'icon-opacity': ['case', ['get', 'is_assigned'], tr.opacity, tr.unassignedOpacity],
      },
    });
    map.addLayer({
      id: 'train-labels', type: 'symbol', source: 'trains', minzoom: tr.labels.minZoom,
      layout: {
        'text-field': ['get', 'line'],
        'text-font': fontBold,
        'text-size': tr.labels.size,
        'text-offset': [0, -1.6],
        'text-allow-overlap': true,
        'text-ignore-placement': true,
      },
      paint: {
        'text-color': ['get', 'color'],
        'text-halo-color': tr.labels.haloColor,
        'text-halo-width': tr.labels.haloWidth,
        'text-opacity': ['case', ['get', 'is_assigned'], 1, 0.45],
      },
    });

    map.on('click', 'trains', (e) => this.showPopup(e.features[0]));
    map.on('mouseenter', 'trains', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'trains', () => { map.getCanvas().style.cursor = ''; });
  }

  addLandmarks(font) {
    const { map } = this;
    const cfg = theme.landmarks;
    if (!cfg.show || !map.getSource(cfg.source)) return;
    map.addImage('landmark-diamond', makeDiamondSDF(48, cfg.marker), { sdf: true, pixelRatio: 2 });
    // Popularity-ranked allow-list (English Wikipedia traffic for Wikidata
    // items inside NYC), so 1788 candidates become a readable 251.
    const allow = landmarkList.names || [];
    for (const tier of cfg.tiers) {
      const filter = ['all', ['has', 'name'], ['match', ['get', 'subclass'], tier.subclasses, true, false]];
      if (allow.length) filter.push(['in', ['get', 'name'], ['literal', allow]]);
      const name = ['coalesce', ['get', 'name:en'], ['get', 'name']];
      map.addLayer({
        id: `landmarks-${tier.id}`, type: 'symbol', source: cfg.source, 'source-layer': cfg.sourceLayer,
        minzoom: tier.minZoom, filter,
        layout: {
          'icon-image': 'landmark-diamond',
          'icon-size': zoomRamp(tier.size),
          'text-field': cfg.uppercase ? ['upcase', name] : name,
          'text-font': font,
          'text-size': tier.labelSize,
          'text-letter-spacing': cfg.letterSpacing,
          'text-offset': [0, 1.15],
          'text-anchor': 'top',
          'text-max-width': 8,
          'text-optional': true,
        },
        paint: {
          'icon-color': tier.color,
          'icon-halo-color': tier.color,
          'icon-halo-width': cfg.haloWidth,
          'icon-halo-blur': cfg.haloBlur,
          'icon-opacity': tier.opacity,
          'text-color': cfg.labelColor,
          'text-halo-color': cfg.labelHaloColor,
          'text-halo-width': 1.3,
          'text-opacity': tier.labelOpacity,
        },
      });
    }
  }

  /** Train detail popup, built from DOM nodes: feed strings are never parsed as HTML. */
  showPopup(feature) {
    const p = feature.properties;
    const el = document.createElement('div');
    el.className = 'subway-popup';
    const line = (text, cls) => {
      const d = document.createElement('div');
      if (cls) d.className = cls;
      d.textContent = text;
      el.appendChild(d);
      return d;
    };
    const head = line('', 'subway-popup-head');
    const bullet = document.createElement('span');
    bullet.className = 'subway-popup-bullet';
    bullet.style.background = typeof p.color === 'string' && /^#[0-9a-f]{6}$/i.test(p.color) ? p.color : '#6D6E71';
    bullet.textContent = String(p.line || '');
    head.appendChild(bullet);
    head.appendChild(document.createTextNode(` to ${p.terminus || '?'}`));
    const eta = p.eta_seconds === '' || p.eta_seconds == null ? null : Number(p.eta_seconds);
    const etaText = eta == null || Number.isNaN(eta) ? '?' : eta <= 0 ? 'now' : eta < 90 ? `${Math.round(eta)}s` : `${Math.round(eta / 60)} min`;
    line(`Next: ${p.next_stop_name || '?'} (${etaText})`);
    const assigned = p.is_assigned === true || p.is_assigned === 'true';
    line(`${assigned ? 'Assigned train' : 'Scheduled, not yet assigned'} · track ${p.actual_track || '?'}`, 'subway-popup-muted');
    if (Number(p.shared) > 1) line(`Shares track with ${Number(p.shared) - 1} other route${Number(p.shared) > 2 ? 's' : ''}`, 'subway-popup-muted');
    if (p.train_id) line(String(p.train_id), 'subway-popup-muted');

    if (this.popup) this.popup.remove();
    this.popupKey = p.key;
    this.popup = new Popup({ closeButton: false, offset: 12, maxWidth: '260px' })
      .setLngLat(feature.geometry.coordinates)
      .setDOMContent(el)
      .addTo(this.map);
    this.popup.on('close', () => { this.popup = null; this.popupKey = null; });
  }
}
