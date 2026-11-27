/*
 * "Pasture" skin for the live subway map: the site's shepherd-at-dusk palette
 * (tailwind.config.cjs / pasture/palette.js) applied to the fun-mta theme
 * format. Every colour here is a site palette token except the route colours,
 * which keep each MTA hue (red stays red, green stays green) so the map stays
 * readable to anyone who knows the system, nudged warmer to sit at dusk.
 */

// Site palette tokens (keep in sync with tailwind.config.cjs).
const C = {
  night: '#1c1938',
  dusk: '#282248',
  plum: '#392854',
  tertiary: '#2c2547',
  black100: '#231d3f',
  black200: '#15122b',
  secondary: '#b9aed0',
  cream: '#f6eac6',
  sun: '#ffc666',
  sunCore: '#ffeaae',
  ember: '#ff964e',
  horizon: '#ab5860',
  cloud: '#665a7e',
  wool: '#dec6ae',
  grassDeep: '#1e422a',
  grassDark: '#365a42',
  grassLight: '#759059',
  wood: '#966636',
  woodLight: '#ae8a5a',
  woodDark: '#4e361e',
};
export const PALETTE = C;

const GLYPHS = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';
const FONT = ['Noto Sans Regular'];
const FONT_BOLD = ['Noto Sans Bold'];

const ramp = (...stops) => ['interpolate', ['linear'], ['zoom'], ...stops.flat()];
const notTunnel = ['!=', ['get', 'brunnel'], 'tunnel'];
const classIn = (...classes) => ['match', ['get', 'class'], classes, true, false];

/*
 * Basemap, authored against the OpenMapTiles schema served by OpenFreeMap
 * (layer filters as in fun-mta's web/styles/nightcity.json). Land is the dusk
 * sky's plum, parks and woods are dark pasture green, water is the deepest
 * night, and roads are dirt-path wood browns that recede behind the subway.
 */
export const basemapStyle = {
  version: 8,
  name: 'Pasture',
  glyphs: GLYPHS,
  sources: {
    openmaptiles: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' },
  },
  layers: [
    { id: 'land', type: 'background', paint: { 'background-color': C.black100 } },
    {
      id: 'water', type: 'fill', source: 'openmaptiles', 'source-layer': 'water',
      filter: notTunnel, paint: { 'fill-color': C.black200 },
    },
    {
      id: 'water-edge', type: 'line', source: 'openmaptiles', 'source-layer': 'water',
      filter: notTunnel,
      paint: { 'line-color': C.plum, 'line-width': ramp([8, 0.6], [12, 1.2], [16, 2]), 'line-opacity': 0.9 },
    },
    {
      id: 'pasture', type: 'fill', source: 'openmaptiles', 'source-layer': 'landcover',
      filter: classIn('wood', 'grass'), paint: { 'fill-color': C.grassDeep, 'fill-opacity': 0.9 },
    },
    {
      id: 'park', type: 'fill', source: 'openmaptiles', 'source-layer': 'park',
      paint: { 'fill-color': C.grassDeep, 'fill-opacity': 0.75 },
    },
    {
      id: 'fabric', type: 'fill', source: 'openmaptiles', 'source-layer': 'landuse',
      filter: classIn('residential', 'commercial', 'retail', 'industrial', 'neighbourhood', 'suburb', 'quarter'),
      paint: { 'fill-color': C.tertiary, 'fill-opacity': ramp([9, 0.7], [14, 0.45], [16, 0.25]) },
    },
    {
      id: 'buildings', type: 'fill', source: 'openmaptiles', 'source-layer': 'building', minzoom: 13,
      paint: { 'fill-color': C.plum, 'fill-opacity': ramp([13, 0.35], [16, 0.6]) },
    },
    {
      id: 'buildings-edge', type: 'line', source: 'openmaptiles', 'source-layer': 'building', minzoom: 14,
      paint: { 'line-color': C.cloud, 'line-width': 0.6, 'line-opacity': ramp([14, 0.2], [17, 0.45]) },
    },
    {
      id: 'roads-minor', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation', minzoom: 12,
      filter: classIn('minor', 'service', 'track', 'path', 'pedestrian'),
      paint: { 'line-color': C.plum, 'line-width': ramp([12, 0.4], [16, 1.6]), 'line-opacity': 0.8 },
    },
    {
      id: 'roads-street', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation', minzoom: 10,
      filter: classIn('street', 'street_limited', 'secondary', 'tertiary'),
      paint: { 'line-color': C.woodDark, 'line-width': ramp([10, 0.5], [13, 1.1], [16, 2.6]), 'line-opacity': 0.85 },
    },
    {
      id: 'roads-major', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation',
      filter: classIn('motorway', 'trunk', 'primary'),
      layout: { 'line-join': 'round' },
      paint: { 'line-color': C.wood, 'line-width': ramp([8, 0.6], [12, 1.2], [16, 3]), 'line-opacity': 0.55 },
    },
    {
      id: 'rail', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation', minzoom: 11,
      filter: ['==', ['get', 'class'], 'rail'],
      paint: { 'line-color': C.cloud, 'line-width': ramp([11, 0.5], [16, 1.4]), 'line-opacity': 0.4, 'line-dasharray': [2, 2] },
    },
    {
      id: 'runway', type: 'line', source: 'openmaptiles', 'source-layer': 'aeroway', minzoom: 10,
      paint: { 'line-color': C.plum, 'line-width': ramp([10, 1], [14, 4]) },
    },
    {
      id: 'place-labels', type: 'symbol', source: 'openmaptiles', 'source-layer': 'place', minzoom: 9,
      filter: classIn('suburb', 'neighbourhood', 'quarter', 'town', 'village'),
      layout: {
        'text-field': ['upcase', ['coalesce', ['get', 'name:en'], ['get', 'name']]],
        'text-font': FONT,
        'text-size': ramp([10, 9], [14, 12], [16, 14]),
        'text-letter-spacing': 0.2,
        'text-max-width': 9,
      },
      paint: { 'text-color': C.secondary, 'text-opacity': 0.5, 'text-halo-color': C.black200, 'text-halo-width': 1.4 },
    },
    {
      id: 'city-labels', type: 'symbol', source: 'openmaptiles', 'source-layer': 'place',
      filter: ['==', ['get', 'class'], 'city'],
      layout: {
        'text-field': ['upcase', ['coalesce', ['get', 'name:en'], ['get', 'name']]],
        'text-font': FONT_BOLD,
        'text-size': ramp([6, 11], [11, 16]),
        'text-letter-spacing': 0.3,
      },
      paint: { 'text-color': C.sun, 'text-opacity': 0.45, 'text-halo-color': C.black200, 'text-halo-width': 1.8 },
    },
  ],
};

/* The subway on top, in the fun-mta theme format (see its README, "Skinning"). */
export const theme = {
  name: 'Pasture',
  basemap: {
    center: [-73.94, 40.72],
    zoom: 10.6,
    minZoom: 9,
    maxZoom: 17,
    background: C.black100,
    fonts: { regular: FONT, bold: FONT_BOLD },
    // NYC plus a margin: the map has no reason to wander off to another city.
    maxBounds: [[-74.6, 40.3], [-73.3, 41.15]],
  },
  lines: {
    opacity: 1.0,
    casingColor: C.black200,
    casingOpacity: 0.95,
    width: [[9, 1.8], [11, 3.0], [13, 4.8], [16, 8.5]],
    casingWidth: [[9, 3.0], [11, 4.6], [13, 6.8], [16, 11.5]],
    // Keep spacing >= casingWidth or neighbouring casings bury each other's colour.
    parallel: { show: true, spacing: [[9, 3.0], [11, 4.7], [13, 7.2], [16, 13.0]] },
    join: 'round',
    cap: 'butt',
    hiddenOpacity: 0.1,
    // MTA hues, warmed for dusk. Shared families keep one colour, like the
    // official map; families stay >= 40 apart in RGB so none blur together.
    colorOverrides: {
      1: '#e5534b', 2: '#e5534b', 3: '#e5534b',
      4: '#3fae5f', 5: '#3fae5f', 6: '#3fae5f',
      7: '#c062d4',
      A: '#4a7fe0', C: '#4a7fe0', E: '#4a7fe0',
      B: C.ember, D: C.ember, F: C.ember, M: C.ember,
      N: C.sun, Q: C.sun, R: C.sun, W: C.sun,
      G: '#a8d062',
      J: C.woodLight, Z: C.woodLight,
      L: C.secondary,
      SI: '#79b6f0',
      GS: '#8d87a6', FS: '#8d87a6', H: '#8d87a6',
    },
  },
  stations: {
    show: true,
    minZoom: 10.5,
    color: C.wool,
    opacity: 0.75,
    hiddenOpacity: 0.12,
    bracket: { size: [[10.5, 0.3], [13, 0.55], [16, 1.0]], thickness: 0.1, gap: 0.34 },
    labels: {
      show: true, minZoom: 13.5, size: 10, color: C.cream, haloColor: C.black200,
      uppercase: true, letterSpacing: 0.12, opacity: 0.9,
    },
  },
  trains: {
    opacity: 1.0,
    unassignedOpacity: 0.3,
    // Sheep sprite scale per zoom (1 = one sprite pixel per CSS pixel).
    size: [[9, 0.6], [11, 0.9], [13, 1.4], [16, 2.4]],
    outline: C.black200,
    labels: { show: true, minZoom: 13, size: 11, haloColor: C.black200, haloWidth: 1.4 },
    arrow: {
      show: true, minZoom: 11, color: C.cream, outlineColor: C.black200, outlineWidth: 0.035,
      pixels: 96, gap: 0.42, length: 0.18, width: 0.15, notch: 0.45,
      size: [[11, 0.9], [13, 1.5], [16, 2.6]], opacity: 0.95, unassignedOpacity: 0.25,
    },
  },
  landmarks: {
    show: true,
    source: 'openmaptiles',
    sourceLayer: 'poi',
    color: C.sun,
    labelColor: C.sunCore,
    labelHaloColor: C.black200,
    uppercase: true,
    letterSpacing: 0.1,
    haloWidth: 0.8,
    haloBlur: 0.6,
    marker: { radius: 0.3, thickness: 0.1, spread: 0.1 },
    // Filtered on `subclass`, which is what separates a landmark from a shop
    // (`class` lumps the NYPL in with bookshops), and tiered by kind -- the
    // source's `rank` is a per-tile index, not an importance score.
    tiers: [
      {
        id: 'civic', minZoom: 13.0, color: C.sun, labelSize: 10, opacity: 0.95, labelOpacity: 0.9,
        subclasses: ['museum', 'monument', 'memorial', 'arts_centre', 'castle', 'zoo', 'aquarium',
          'stadium', 'university', 'viewpoint', 'lighthouse', 'library', 'cathedral',
          'theme_park', 'planetarium'],
        size: [[13, 0.34], [16, 0.62], [18, 0.9]],
      },
      {
        id: 'local', minZoom: 15.0, color: C.ember, labelSize: 8.5, opacity: 0.7, labelOpacity: 0.65,
        subclasses: ['attraction', 'artwork'],
        size: [[15, 0.24], [18, 0.5]],
      },
    ],
  },
  animation: { tickMs: 1000 },
};
