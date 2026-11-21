// Pure scene layout + helpers shared by the scenery and the herd logic.
// (No React/three imports, so herd.js can be simulated in plain Node.)

// Deterministic PRNG so the scenery is identical on every visit.
export const mulberry32 = (seed) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// The sheep pen (world units): fence rectangle and the gate gap on its west side.
export const PEN = { x0: 5, x1: 11, z0: -7, z1: -1, gateZ0: -4.6, gateZ1: -3.2 };
