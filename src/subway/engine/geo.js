/*
 * Geometry helpers for placing trains on subway line polylines.
 * Ported from fun-mta (mta_map/geo.py).
 *
 * Everything works in a local equirectangular plane scaled so one unit is one
 * metre. NYC spans ~0.5 degrees of latitude, so a single cos(lat) factor taken
 * at the city's centre is accurate to well under a metre here.
 *
 * Points are [lon, lat] arrays, matching GeoJSON.
 */

import { bisectRight, pyMod } from './py.js';

export const EARTH_R = 6371008.8; // WGS84 mean radius, metres
export const NYC_LAT = 40.73;

const DEG = Math.PI / 180.0; // CPython's math.radians factor
const RAD = 180.0 / Math.PI; // CPython's math.degrees factor

export const KY = 1.0 * DEG * EARTH_R;
export const KX = KY * Math.cos(NYC_LAT * DEG);

/** Cumulative along-line distance in metres for each vertex. */
export function cumulative(pts) {
  const cum = [0.0];
  for (let i = 1; i < pts.length; i++) {
    const dx = (pts[i][0] - pts[i - 1][0]) * KX;
    const dy = (pts[i][1] - pts[i - 1][1]) * KY;
    cum.push(cum[i - 1] + Math.hypot(dx, dy));
  }
  return cum;
}

/** Great-circle distance in metres. */
export function haversine(a, b) {
  const lon1 = a[0] * DEG;
  const lat1 = a[1] * DEG;
  const lon2 = b[0] * DEG;
  const lat2 = b[1] * DEG;
  const h = Math.sin((lat2 - lat1) / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.sqrt(h));
}

/**
 * Compass bearing (degrees clockwise from north) of segment `i`.
 *
 * Skips zero-length segments rather than reporting due north for them: a
 * sliced polyline can begin with one when a stop sits exactly on a vertex.
 */
export function bearingAt(pts, i) {
  if (pts.length < 2) return 0.0;
  i = Math.max(0, Math.min(i, pts.length - 2));
  const order = [];
  for (let j = i; j < pts.length - 1; j++) order.push(j);
  for (let j = i - 1; j >= 0; j--) order.push(j);
  for (const j of order) {
    const dx = (pts[j + 1][0] - pts[j][0]) * KX;
    const dy = (pts[j + 1][1] - pts[j][1]) * KY;
    if (dx !== 0.0 || dy !== 0.0) return pyMod(Math.atan2(dx, dy) * RAD, 360.0);
  }
  return 0.0;
}

/** Compass bearing from `a` to `b`, degrees clockwise from north. */
export function bearingBetween(a, b) {
  const dx = (b[0] - a[0]) * KX;
  const dy = (b[1] - a[1]) * KY;
  if (dx === 0.0 && dy === 0.0) return 0.0;
  return pyMod(Math.atan2(dx, dy) * RAD, 360.0);
}

/** Index of the polyline segment containing `target` metres along it. */
export function segmentIndex(pts, cum, target) {
  if (pts.length < 2) return 0;
  const i = bisectRight(cum, target) - 1;
  return Math.max(0, Math.min(i, pts.length - 2));
}

/** Point at `target` metres along the polyline, as [lon, lat, bearing]. */
export function interpolate(pts, cum, target) {
  if (pts.length === 1) return [pts[0][0], pts[0][1], 0.0];
  const total = cum[cum.length - 1];
  if (target <= 0.0) return [pts[0][0], pts[0][1], bearingAt(pts, 0)];
  if (target >= total) {
    const last = pts[pts.length - 1];
    return [last[0], last[1], bearingAt(pts, pts.length - 2)];
  }
  let i = bisectRight(cum, target) - 1;
  i = Math.max(0, Math.min(i, pts.length - 2));
  const span = cum[i + 1] - cum[i];
  const t = span <= 0.0 ? 0.0 : (target - cum[i]) / span;
  const lon = pts[i][0] + t * (pts[i + 1][0] - pts[i][0]);
  const lat = pts[i][1] + t * (pts[i + 1][1] - pts[i][1]);
  return [lon, lat, bearingAt(pts, i)];
}

/** Total length of a polyline in metres. */
export function polylineLength(pts) {
  return pts.length > 1 ? cumulative(pts)[pts.length - 1] : 0.0;
}
