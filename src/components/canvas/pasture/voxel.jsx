import * as THREE from "three";

export { PALETTE } from "./palette";

// One shared unit cube; every voxel is this geometry scaled.
export const unitBox = new THREE.BoxGeometry(1, 1, 1);

// 3-step toon ramp -> hard-edged light bands, like hand-shaded pixel art.
const ramp = new THREE.DataTexture(new Uint8Array([110, 185, 255]), 3, 1, THREE.RedFormat);
ramp.minFilter = THREE.NearestFilter;
ramp.magFilter = THREE.NearestFilter;
ramp.generateMipmaps = false;
ramp.needsUpdate = true;

const toonCache = new Map();
export const toon = (color) => {
  if (!toonCache.has(color)) {
    toonCache.set(color, new THREE.MeshToonMaterial({ color, gradientMap: ramp }));
  }
  return toonCache.get(color);
};

const flatCache = new Map();
// Unlit material for sky objects and shadows (exact palette color on screen).
export const flat = (color, opts = {}) => {
  const key = `${color}|${JSON.stringify(opts)}`;
  if (!flatCache.has(key)) {
    flatCache.set(key, new THREE.MeshBasicMaterial({ color, ...opts }));
  }
  return flatCache.get(key);
};

/** A single voxel: size [w, h, d], position [x, y, z]. */
export const Vox = ({ s, p, c, rot, unlit = false }) => (
  <mesh
    geometry={unitBox}
    material={unlit ? flat(c) : toon(c)}
    scale={s}
    position={p}
    rotation={rot}
  />
);

/** Flat dark patch under a character, like the drop shadows in the banner. */
export const BlobShadow = ({ w = 1.4, d = 1, x = 0, z = 0 }) => (
  <mesh
    geometry={unitBox}
    material={flat("#2b4a37")}
    scale={[w, 0.02, d]}
    position={[x, 0.012, z]}
  />
);
