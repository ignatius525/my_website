// Behaviour for everything that moves in the pasture: sheep, dogs, shepherds.
//
// Each character is a plain mutable "brain" object updated once per frame
// (no React state). Components in Characters.jsx only read brains to pose
// their meshes. Every brain has { x, z, h } (position + heading in the xz
// plane, h = atan2(dz, dx)) plus animation values (phase, moving, ...).

import { PEN, mulberry32 } from "./layout.js";
import { PALETTE as C } from "./palette.js";

/* ------------------------------------------------------------ geometry -- */

export const FIELD = { x0: -8, x1: 3.2, z0: -9, z1: 3 };
const PEN_INNER = { x0: PEN.x0 + 0.8, x1: PEN.x1 - 0.8, z0: PEN.z0 + 0.8, z1: PEN.z1 - 0.8 };
// Solid area around the pen fence that dogs and shepherds may not enter.
const PEN_BLOCK = { x0: PEN.x0 - 0.8, x1: PEN.x1 + 0.8, z0: PEN.z0 - 0.8, z1: PEN.z1 + 0.8 };
const LANTERN = { x: PEN.x0 - 0.5, z: PEN.gateZ1 + 1.2, r: 0.7 };
const ROAM = { x0: -11.5, x1: 12.5, z0: -11, z1: 5 }; // where dogs may run (on screen)
const SHEPHERD_ZONE = { x0: -10, x1: 1.5, z0: -4.5, z1: 4 };
// Waypoints just outside the pen's corners, used to walk around it.
const CORNERS = [
  [PEN_BLOCK.x0 - 0.5, PEN_BLOCK.z0 - 0.5],
  [PEN_BLOCK.x1 + 0.5, PEN_BLOCK.z0 - 0.5],
  [PEN_BLOCK.x1 + 0.5, PEN_BLOCK.z1 + 0.5],
  [PEN_BLOCK.x0 - 0.5, PEN_BLOCK.z1 + 0.5],
];

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const angleTo = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));
const inBox = (x, z, b) => x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1;
const range = (rnd, a, b) => a + rnd() * (b - a);
const pickWeighted = (rnd, options) => {
  const total = options.reduce((s, [, w]) => s + w, 0);
  let r = rnd() * total;
  for (const [name, w] of options) {
    if ((r -= w) <= 0) return name;
  }
  return options[0][0];
};

const clampTo = (p, b) => {
  p.x = clamp(p.x, b.x0, b.x1);
  p.z = clamp(p.z, b.z0, b.z1);
};

/** Push p out of an axis-aligned box through its nearest edge. */
const pushOutOfBox = (p, box) => {
  if (!inBox(p.x, p.z, box)) return;
  const d = [p.x - box.x0, box.x1 - p.x, p.z - box.z0, box.z1 - p.z];
  const m = Math.min(...d);
  if (m === d[0]) p.x = box.x0;
  else if (m === d[1]) p.x = box.x1;
  else if (m === d[2]) p.z = box.z0;
  else p.z = box.z1;
};

/**
 * Move p (only p) so it is at least r away from (ox, oz). `share` is p's part
 * of the correction; `maxStep` caps it per frame so overlaps ease apart
 * instead of snapping (a snap reads as a teleport on screen).
 */
const pushFrom = (p, ox, oz, r, share = 1, maxStep = Infinity) => {
  const dx = p.x - ox;
  const dz = p.z - oz;
  const d = Math.hypot(dx, dz);
  if (d > 0.0001 && d < r) {
    const k = Math.min((r - d) * share, maxStep);
    p.x += (dx / d) * k;
    p.z += (dz / d) * k;
  }
};

/** Snap a target outside the pen so nobody tries to stand inside the fence. */
const safePoint = (x, z) => {
  const p = { x, z };
  if (inBox(x, z, PEN_BLOCK)) {
    pushOutOfBox(p, PEN_BLOCK);
    p.x += Math.sign(p.x - (PEN.x0 + PEN.x1) / 2) * 0.3;
    p.z += Math.sign(p.z - (PEN.z0 + PEN.z1) / 2) * 0.3;
  }
  return p;
};

const segmentHitsPen = (ax, az, bx, bz) => {
  for (let i = 1; i < 14; i++) {
    const t = i / 14;
    if (inBox(ax + (bx - ax) * t, az + (bz - az) * t, PEN_BLOCK)) return true;
  }
  return false;
};

/** Where to head next: the target itself, or a pen corner to route around the fence. */
const waypoint = (p, tx, tz) => {
  if (!segmentHitsPen(p.x, p.z, tx, tz)) return [tx, tz];
  let best = null;
  let bestCost = Infinity;
  for (const [cx, cz] of CORNERS) {
    if (Math.hypot(cx - p.x, cz - p.z) < 0.3 || segmentHitsPen(p.x, p.z, cx, cz)) continue;
    const cost = Math.hypot(cx - p.x, cz - p.z) + Math.hypot(tx - cx, tz - cz);
    if (cost < bestCost) {
      bestCost = cost;
      best = [cx, cz];
    }
  }
  return best || [tx, tz];
};

/**
 * Turn toward and move to (tx, tz), routing around the pen and weaving around
 * any `obstacles` ({x, z}) in front. Returns the distance left to the target.
 */
const steerTo = (p, tx, tz, speed, dt, turnRate = 6, obstacles = []) => {
  const [wx, wz] = waypoint(p, tx, tz);
  const dx = wx - p.x;
  const dz = wz - p.z;
  const d = Math.hypot(dx, dz);
  if (d > 0.05) {
    let ax = dx / d;
    let az = dz / d;
    const fx = Math.cos(p.h);
    const fz = Math.sin(p.h);
    for (const o of obstacles) {
      const rx = o.x - p.x;
      const rz = o.z - p.z;
      const od = Math.hypot(rx, rz);
      if (od > 2.2 || od < 0.001) continue;
      const ahead = (rx * fx + rz * fz) / od;
      if (ahead > 0) {
        // Push sideways (perpendicular to the obstacle) so we curve past it.
        const k = ((2.2 - od) / 2.2) * ahead * 2.2;
        const side = Math.sign(rx * -fz + rz * fx) || 1;
        ax += -side * -fz * k - (rx / od) * k * 0.5;
        az += -side * fx * k - (rz / od) * k * 0.5;
      }
    }
    const turn = angleTo(p.h, Math.atan2(az, ax));
    p.h += clamp(turn, -turnRate * dt, turnRate * dt);
    // Slow down while turning hard, so paths arc instead of pivoting.
    const step = Math.min(d, speed * dt) * Math.max(0.25, Math.cos(turn));
    p.x += Math.cos(p.h) * step;
    p.z += Math.sin(p.h) * step;
  }
  return Math.hypot(tx - p.x, tz - p.z);
};

const faceToward = (p, x, z, dt, rate = 4) => {
  p.h += clamp(angleTo(p.h, Math.atan2(z - p.z, x - p.x)), -rate * dt, rate * dt);
};

const centroid = (list) => ({
  x: list.reduce((a, s) => a + s.x, 0) / list.length,
  z: list.reduce((a, s) => a + s.z, 0) / list.length,
});

/** Leg animation from how far the character actually moved this frame. */
const animateGait = (p, dt, refSpeed, stride) => {
  const v = Math.hypot(p.x - p.px, p.z - p.pz) / Math.max(dt, 1e-4);
  p.moving += (clamp(v / refSpeed, 0, 1.4) - p.moving) * Math.min(1, dt * 8);
  p.phase += v * dt * stride;
};

/* --------------------------------------------------------------- world -- */

export const DOG_COATS = {
  collie: { main: C.dogBlack, white: C.dogWhite },
  red: { main: "#b8692f", white: C.dogWhite }, // brown-orange "red merle" style
};

export const createWorld = () => {
  const rnd = mulberry32(42);
  const sheep = [];
  const spawn = (bounds, penned, n) => {
    for (let i = 0; i < n; i++) {
      let x;
      let z;
      let tries = 0;
      do {
        x = range(rnd, bounds.x0, bounds.x1);
        z = range(rnd, bounds.z0, bounds.z1);
      } while (tries++ < 30 && sheep.some((s) => Math.hypot(s.x - x, s.z - z) < 2.2));
      sheep.push({
        x, z, px: x, pz: z, tx: x, tz: z, h: rnd() * Math.PI * 2,
        mode: "graze", timer: rnd() * 4, speed: 0, phase: rnd() * 6, moving: 0,
        graze: 1, look: 0, hop: 0, wait: 0, leader: null, seed: rnd() * 10,
        bounds, penned, rnd,
      });
    }
  };
  spawn(FIELD, false, 12);
  spawn(PEN_INNER, true, 3);

  const dog = (x, z, coat, seed) => ({
    x, z, px: x, pz: z, h: 0, coat, rnd: mulberry32(seed),
    mode: "herd", timer: 2 + seed % 3, phase: 0, moving: 0, sit: 0,
    tx: x, tz: z, speed: 3, angle: seed, dir: 1, orbitSpeed: 3.2, radiusAdd: 0,
    barking: false, barkAge: 9, nextBark: 0, barksLeft: 0,
  });

  const shepherd = (x, z, shirt, seed) => ({
    x, z, px: x, pz: z, h: Math.PI / 2, yaw: 0.3, shirt, seed, rnd: mulberry32(seed + 100),
    mode: "stand", timer: 2 + seed * 3, tx: x, tz: z, speed: 0.9, phase: 0, moving: 0,
    raise: 0, look: 0,
  });

  return {
    sheep,
    dogs: [dog(-1, 2, DOG_COATS.collie, 7), dog(-6, -6, DOG_COATS.red, 13)],
    shepherds: [shepherd(-7.2, -0.6, C.redShirt, 1), shepherd(-5.4, 1.6, C.blueShirt, 2)],
    time: 0,
  };
};

/* --------------------------------------------------------------- sheep -- */

/** A spot near (cx, cz) that is as far as possible from other sheep and their targets. */
const freeSpot = (b, w, cx, cz, radius) => {
  let best = [b.x, b.z];
  let bestScore = -Infinity;
  for (let i = 0; i < 10; i++) {
    const x = clamp(cx + (b.rnd() - 0.5) * 2 * radius, b.bounds.x0, b.bounds.x1);
    const z = clamp(cz + (b.rnd() - 0.5) * 2 * radius, b.bounds.z0, b.bounds.z1);
    let minD = Infinity;
    for (const o of w.sheep) {
      if (o === b || o.penned !== b.penned) continue;
      minD = Math.min(minD, Math.hypot(o.x - x, o.z - z), Math.hypot(o.tx - x, o.tz - z));
    }
    for (const s of w.shepherds) minD = Math.min(minD, Math.hypot(s.x - x, s.z - z) - 0.6);
    if (minD > bestScore) {
      bestScore = minD;
      best = [x, z];
    }
    if (minD > 2.4) break; // good enough
  }
  return best;
};

const chooseSheepMode = (b, w) => {
  const mates = w.sheep.filter((o) => o.penned === b.penned);
  const c = centroid(mates);
  const far = !b.penned && Math.hypot(b.x - c.x, b.z - c.z) > 4.5;
  b.hop = 0;
  b.wait = 0;
  b.leader = null;

  const mode = far && b.rnd() < 0.7
    ? "regroup"
    : pickWeighted(b.rnd, [
        ["graze", 0.26],
        ["idle", 0.12],
        ["amble", 0.2],
        ["browse", 0.16],
        ["follow", b.penned ? 0.05 : 0.18],
        ["frolic", b.penned ? 0 : 0.05],
      ]);
  b.mode = mode;

  switch (mode) {
    case "graze":
      b.speed = 0;
      b.timer = range(b.rnd, 2.5, 7);
      break;
    case "idle":
      b.speed = 0;
      b.timer = range(b.rnd, 1.5, 4);
      break;
    case "regroup": {
      [b.tx, b.tz] = freeSpot(b, w, c.x, c.z, 2.5);
      b.speed = 0.65;
      b.timer = 12;
      break;
    }
    case "amble":
      [b.tx, b.tz] = freeSpot(b, w, b.x, b.z, 4);
      b.speed = range(b.rnd, 0.45, 0.6);
      b.timer = 12;
      break;
    case "browse": // slow, head-down wander while eating
      [b.tx, b.tz] = freeSpot(b, w, b.x, b.z, 2.5);
      b.speed = 0.22;
      b.timer = 14;
      break;
    case "frolic": // a quick, bouncy trot
      [b.tx, b.tz] = freeSpot(b, w, b.x, b.z, 4.5);
      b.speed = 1.15;
      b.timer = 3.5;
      break;
    case "follow": {
      // Trail behind a flock-mate, which strings the flock into little lines.
      const options = mates.filter((o) => o !== b && o.leader !== b);
      b.leader = options[Math.floor(b.rnd() * options.length)] || null;
      b.speed = 0.75;
      b.timer = range(b.rnd, 5, 10);
      if (!b.leader) b.mode = "graze";
      break;
    }
    default:
      break;
  }
};

const WALKING = new Set(["amble", "browse", "frolic", "regroup", "follow", "flee"]);

const updateSheep = (b, dt, w) => {
  b.px = b.x;
  b.pz = b.z;
  b.timer -= dt;

  // Dogs: scatter when one gets close, or from further away when it barks.
  if (!b.penned) {
    for (const d of w.dogs) {
      const r = d.barking ? 4.8 : 2.4;
      const dx = b.x - d.x;
      const dz = b.z - d.z;
      const dist = Math.hypot(dx, dz) || 1;
      if (dist < r) {
        b.mode = "flee";
        b.speed = d.barking ? 2.0 : 1.6;
        b.timer = Math.max(b.timer, 1.2);
        b.hop = 0;
        b.leader = null;
        b.tx = clamp(b.x + (dx / dist) * 3, b.bounds.x0, b.bounds.x1);
        b.tz = clamp(b.z + (dz / dist) * 3, b.bounds.z0, b.bounds.z1);
      }
    }
  }

  if (b.timer <= 0) chooseSheepMode(b, w);

  if (b.mode === "follow" && b.leader) {
    const L = b.leader;
    b.tx = clamp(L.x - Math.cos(L.h) * 2.0, b.bounds.x0, b.bounds.x1);
    b.tz = clamp(L.z - Math.sin(L.h) * 2.0, b.bounds.z0, b.bounds.z1);
    b.speed = clamp((Math.hypot(b.tx - b.x, b.tz - b.z) - 0.2) * 0.8, 0, 0.8);
  }

  if (WALKING.has(b.mode)) {
    const dx = b.tx - b.x;
    const dz = b.tz - b.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.3 && b.mode !== "follow") {
      b.mode = b.rnd() < 0.65 ? "graze" : "idle";
      b.timer = range(b.rnd, 2, 6);
      b.speed = 0;
    } else if (dist > 0.05) {
      // Steer: toward the target, away from sheep in front of us.
      let ax = dx / dist;
      let az = dz / dist;
      const fx = Math.cos(b.h);
      const fz = Math.sin(b.h);
      let blocked = false;
      for (const o of w.sheep) {
        if (o === b || o.penned !== b.penned) continue;
        const rx = o.x - b.x;
        const rz = o.z - b.z;
        const d = Math.hypot(rx, rz);
        if (d > 2.6 || d < 0.001) continue;
        const ahead = (rx * fx + rz * fz) / d; // 1 = dead ahead
        if (ahead > 0.2) {
          const push = ((2.6 - d) / 2.6) * ahead * 1.6;
          ax -= (rx / d) * push;
          az -= (rz / d) * push;
          if (d < 1.9 && ahead > 0.75 && o.moving < 0.2) blocked = true;
        }
      }
      if (blocked) {
        // Someone is standing in the way: wait a moment, then pick a new spot.
        b.wait += dt;
        if (b.wait > 1.2 && b.mode !== "flee") {
          [b.tx, b.tz] = freeSpot(b, w, b.x, b.z, 3.5);
          b.wait = 0;
        }
      } else {
        b.wait = Math.max(0, b.wait - dt);
      }
      const turn = angleTo(b.h, Math.atan2(az, ax));
      b.h += clamp(turn, -2.6 * dt, 2.6 * dt);
      const step = (blocked ? 0.15 : 1) * b.speed * dt * Math.max(0.15, Math.cos(turn));
      b.x += Math.cos(b.h) * step;
      b.z += Math.sin(b.h) * step;
    }
  }

  // Hard constraints: never overlap another sheep or a shepherd.
  for (const o of w.sheep) if (o !== b && o.penned === b.penned) pushFrom(b, o.x, o.z, 1.8, 0.5);
  for (const s of w.shepherds) pushFrom(b, s.x, s.z, 1.5, 1, 4 * dt);
  if (!b.penned) for (const d of w.dogs) pushFrom(b, d.x, d.z, 1.15, 0.5, 3 * dt);
  clampTo(b, b.bounds);

  animateGait(b, dt, 0.55, 9);
  const headDown = b.mode === "graze" ? 1 : b.mode === "browse" ? 0.55 : 0;
  b.graze += (headDown - b.graze) * Math.min(1, dt * 3);
  b.look = b.mode === "idle" ? Math.sin(w.time * 0.9 + b.seed) * 0.6 : b.look * (1 - Math.min(1, dt * 4));
  b.hop = b.mode === "frolic" ? Math.abs(Math.sin(b.phase * 0.45)) * 0.35 : b.hop * (1 - Math.min(1, dt * 8));
};

/* ---------------------------------------------------------------- dogs -- */

const startBarking = (d, count) => {
  d.barksLeft = count;
  d.nextBark = 0.15;
};

const chooseDogMode = (d, w, c) => {
  const free = w.sheep.filter((s) => !s.penned);
  d.mode = d.forced || pickWeighted(d.rnd, [
    ["herd", 0.34],
    ["dash", 0.14],
    ["trot", 0.14],
    ["sit", 0.16],
    ["watch", 0.1],
    ["bark", 0.12],
  ]);
  d.forced = null;
  switch (d.mode) {
    case "herd":
      d.timer = range(d.rnd, 4, 9);
      if (d.rnd() < 0.4) d.dir *= -1;
      d.orbitSpeed = range(d.rnd, 2.4, 4.2);
      d.radiusAdd = range(d.rnd, 0, 2.2);
      d.angle = Math.atan2(d.z - c.z, d.x - c.x);
      break;
    case "dash": {
      // Sprint out past the sheep that has strayed furthest from the flock.
      const stray = free.reduce((a, s) => (Math.hypot(s.x - c.x, s.z - c.z) > Math.hypot(a.x - c.x, a.z - c.z) ? s : a));
      const dx = stray.x - c.x;
      const dz = stray.z - c.z;
      const len = Math.hypot(dx, dz) || 1;
      const p = safePoint(stray.x + (dx / len) * 2, stray.z + (dz / len) * 2);
      d.tx = clamp(p.x, ROAM.x0, ROAM.x1);
      d.tz = clamp(p.z, ROAM.z0, ROAM.z1);
      d.speed = range(d.rnd, 4.2, 5.2);
      d.timer = 5;
      break;
    }
    case "trot": {
      const p = safePoint(range(d.rnd, ROAM.x0, ROAM.x1), range(d.rnd, ROAM.z0, ROAM.z1));
      d.tx = p.x;
      d.tz = p.z;
      d.speed = range(d.rnd, 1.4, 2.2);
      d.timer = 9;
      break;
    }
    case "sit":
      d.timer = range(d.rnd, 2.5, 6);
      if (d.rnd() < 0.45) startBarking(d, 1 + Math.floor(d.rnd() * 2));
      break;
    case "watch":
      d.timer = range(d.rnd, 1.5, 3.5);
      break;
    case "bark":
      startBarking(d, 2 + Math.floor(d.rnd() * 2));
      d.timer = d.barksLeft * 0.75 + 0.6;
      break;
    default:
      break;
  }
};

const updateDog = (d, dt, w) => {
  d.px = d.x;
  d.pz = d.z;
  const free = w.sheep.filter((s) => !s.penned);
  const c = centroid(free);
  d.timer -= dt;
  if (d.timer <= 0) chooseDogMode(d, w, c);

  switch (d.mode) {
    case "herd": {
      const spread = Math.max(...free.map((s) => Math.hypot(s.x - c.x, s.z - c.z)));
      const radius = clamp(spread + 2.2 + d.radiusAdd + Math.sin(w.time * 0.7 + d.angle) * 0.6, 4, 8);
      d.angle += (d.dir * d.orbitSpeed * dt) / radius;
      const p = safePoint(c.x + Math.cos(d.angle) * radius, c.z + Math.sin(d.angle) * radius);
      steerTo(d, clamp(p.x, ROAM.x0, ROAM.x1), clamp(p.z, ROAM.z0, ROAM.z1), d.orbitSpeed * 1.25, dt, 7, free);
      break;
    }
    case "dash":
    case "trot":
      if (steerTo(d, d.tx, d.tz, d.speed, dt, 7, free) < 0.8) {
        d.mode = "watch";
        d.timer = range(d.rnd, 1.2, 2.5);
        if (d.rnd() < 0.4) startBarking(d, 1 + Math.floor(d.rnd() * 2));
      }
      break;
    default: // sit, watch, bark: stay put, keep an eye on the flock
      faceToward(d, c.x, c.z, dt);
      break;
  }

  // Barking: a short pop of the "!" bubble per bark; sheep react while it shows.
  d.barkAge += dt;
  if (d.barksLeft > 0) {
    d.nextBark -= dt;
    if (d.nextBark <= 0) {
      d.barkAge = 0;
      d.barksLeft -= 1;
      d.nextBark = range(d.rnd, 0.55, 0.85);
    }
  }
  d.barking = d.barkAge < 0.6;

  d.sit += ((d.mode === "sit" ? 1 : 0) - d.sit) * Math.min(1, dt * 5);

  // Collisions: other dogs, sheep, shepherds, the lantern post, the pen.
  for (const o of w.dogs) if (o !== d) pushFrom(d, o.x, o.z, 1.3, 0.5, 4 * dt);
  for (const s of w.sheep) if (!s.penned) pushFrom(d, s.x, s.z, 1.15, 0.5, 3 * dt);
  for (const s of w.shepherds) pushFrom(d, s.x, s.z, 1.0, 1, 4 * dt);
  pushFrom(d, LANTERN.x, LANTERN.z, LANTERN.r);
  pushOutOfBox(d, PEN_BLOCK);
  clampTo(d, ROAM);

  animateGait(d, dt, 3, 4.5);
};

/* ----------------------------------------------------------- shepherds -- */

const chooseShepherdMode = (s, w) => {
  s.mode = pickWeighted(s.rnd, [
    ["stand", 0.45],
    ["walk", 0.4],
    ["signal", 0.15],
  ]);
  if (s.mode === "walk") {
    const other = w.shepherds.find((o) => o !== s);
    let p;
    let tries = 0;
    do {
      p = safePoint(range(s.rnd, SHEPHERD_ZONE.x0, SHEPHERD_ZONE.x1), range(s.rnd, SHEPHERD_ZONE.z0, SHEPHERD_ZONE.z1));
    } while (
      tries++ < 10 &&
      (Math.hypot(p.x - s.x, p.z - s.z) < 2 || Math.hypot(p.x - other.tx, p.z - other.tz) < 2.2)
    );
    s.tx = p.x;
    s.tz = p.z;
    s.speed = range(s.rnd, 0.75, 1.05);
    s.timer = 15;
  } else if (s.mode === "signal") {
    // Raise the crook; the nearest dog that isn't sitting sprints out.
    s.timer = 1.8;
    const dog = w.dogs
      .filter((d) => d.mode !== "sit")
      .sort((a, b) => Math.hypot(a.x - s.x, a.z - s.z) - Math.hypot(b.x - s.x, b.z - s.z))[0];
    if (dog) {
      dog.forced = "dash";
      dog.timer = 0;
    }
  } else {
    s.timer = range(s.rnd, 3, 8);
  }
};

const updateShepherd = (s, dt, w) => {
  s.px = s.x;
  s.pz = s.z;
  s.timer -= dt;
  if (s.timer <= 0) chooseShepherdMode(s, w);

  let targetYaw;
  if (s.mode === "walk") {
    if (steerTo(s, s.tx, s.tz, s.speed, dt, 3) < 0.3) {
      s.mode = "stand";
      s.timer = range(s.rnd, 3, 7);
    }
    // Model faces +z, heading is measured from +x.
    targetYaw = Math.atan2(Math.cos(s.h), Math.sin(s.h));
  } else {
    // Standing: mostly face the viewer, glancing toward the flock now and then.
    s.look = Math.sin(w.time * 0.35 + s.seed * 3) > 0.55 ? 0.6 : 0;
    targetYaw = 0.25;
  }
  s.yaw += angleTo(s.yaw, targetYaw) * Math.min(1, dt * 5);
  s.raise += ((s.mode === "signal" ? 1 : 0) - s.raise) * Math.min(1, dt * 6);

  for (const o of w.shepherds) if (o !== s) pushFrom(s, o.x, o.z, 1.5, 0.5);
  pushFrom(s, LANTERN.x, LANTERN.z, LANTERN.r);
  pushOutOfBox(s, PEN_BLOCK);
  clampTo(s, { x0: SHEPHERD_ZONE.x0 - 1, x1: SHEPHERD_ZONE.x1 + 1, z0: SHEPHERD_ZONE.z0 - 1, z1: SHEPHERD_ZONE.z1 + 1 });

  animateGait(s, dt, 0.9, 7);
};

/* ---------------------------------------------------------------- tick -- */

export const stepWorld = (w, delta) => {
  const dt = Math.min(delta, 0.05); // avoid jumps after a background tab
  w.time += dt;
  w.shepherds.forEach((s) => updateShepherd(s, dt, w));
  w.dogs.forEach((d) => updateDog(d, dt, w));
  w.sheep.forEach((s) => updateSheep(s, dt, w));
};
