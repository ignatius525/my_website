import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import { PALETTE as C, Vox, flat, toon, unitBox } from "./voxel";
import { PEN, mulberry32 } from "./layout";

const DEG = Math.PI / 180;
const pixelTexture = (canvas) => {
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
};

/* ------------------------------------------------------------------ sky -- */

// [top elevation of band in degrees, color], from the horizon upward.
// Proportions match the banner: warm glow hugging the ridge, deep navy above.
const SKY_BANDS = [
  [0.8, "#c8705a"],
  [1.8, "#ab5860"],
  [2.8, "#92475e"],
  [3.8, "#854464"],
  [4.8, "#713a64"],
  [5.8, "#61325c"],
  [6.9, "#4f3260"],
  [8.0, "#432958"],
  [9.1, "#3a2956"],
  [10.2, "#33244f"],
  [11.4, "#282248"],
  [12.6, "#201a40"],
  [91, "#1c1938"],
];

const makeSkyTexture = () => {
  const W = 8;
  const H = 2048;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  for (let y = 0; y < H; y++) {
    const elev = (0.5 - (y + 0.5) / H) * 180; // sphere v -> elevation
    let i = SKY_BANDS.findIndex(([top]) => elev < top);
    if (i < 0) i = SKY_BANDS.length - 1;
    const prevTop = i > 0 ? SKY_BANDS[i - 1][0] : -999;
    // Checkerboard dither just above each band edge, like the banner.
    const dither = elev - prevTop < 0.45 && i > 0;
    for (let x = 0; x < W; x++) {
      ctx.fillStyle = dither && (x + y) % 2 === 0 ? SKY_BANDS[i - 1][1] : SKY_BANDS[i][1];
      ctx.fillRect(x, y, 1, 1);
    }
  }
  const tex = pixelTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.repeat.set(96, 1);
  return tex;
};

const makeHaloTexture = () => {
  const N = 64;
  const canvas = document.createElement("canvas");
  canvas.width = N;
  canvas.height = N;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const r = Math.hypot(x - N / 2 + 0.5, y - N / 2 + 0.5) / (N / 2);
      // Dense checker near the sun, sparser further out: a dithered glow.
      const on = r < 0.72 ? (x + y) % 2 === 0 : r < 1 ? x % 2 === 0 && y % 2 === 0 : false;
      if (on) ctx.fillRect(x, y, 1, 1);
    }
  }
  return pixelTexture(canvas);
};

const Sun = () => {
  const ref = useRef();
  const halo = useMemo(makeHaloTexture, []);
  const size = useThree((s) => s.size);

  useFrame(({ camera }) => {
    if (!ref.current) return;
    const aspect = size.width / size.height;
    const az = (aspect >= 1 ? 21 : 9) * DEG;
    const el = 2.2 * DEG;
    const dist = 175;
    ref.current.position.set(Math.sin(az) * dist, Math.tan(el) * dist, -Math.cos(az) * dist);
    ref.current.lookAt(camera.position);
  });

  const R = 6.5;
  return (
    <group ref={ref}>
      <mesh position={[0, 0, -0.4]}>
        <planeGeometry args={[R * 5.2, R * 5.2]} />
        <meshBasicMaterial map={halo} color={C.ember} transparent opacity={0.5} fog={false} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0, -0.3]} material={flat(C.ember, { fog: false })}>
        <circleGeometry args={[R * 1.22, 20]} />
      </mesh>
      <mesh position={[0, 0, -0.2]} material={flat(C.sun, { fog: false })}>
        <circleGeometry args={[R * 1.1, 20]} />
      </mesh>
      <mesh material={flat(C.sunCore, { fog: false })}>
        <circleGeometry args={[R, 20]} />
      </mesh>
    </group>
  );
};

// Cloud silhouettes: rows of [width, xOffset], bottom row is the sunlit rim.
const CLOUD_SHAPES = [
  [[11, 0.5], [16, 0], [12, -1], [6, 0.5]],
  [[8, 0], [12, -0.5], [7, 0.5]],
  [[13, 0], [18, 0.5], [13, 1.5], [9, 0], [4, 1]],
];

const Cloud = ({ shape, scale }) => {
  const rows = CLOUD_SHAPES[shape];
  const h = 1.3;
  return (
    <group scale={scale}>
      {rows.map(([w, x], i) => (
        <Vox
          key={i}
          s={[w, h, 0.2]}
          p={[x, i * h, -i * 0.01]}
          c={i === 0 ? C.cloudRim : i === rows.length - 1 ? "#7a6892" : C.cloud}
          unlit
        />
      ))}
    </group>
  );
};

const Clouds = ({ animate }) => {
  const refs = useRef([]);
  const clouds = useMemo(() => {
    const rnd = mulberry32(11);
    return Array.from({ length: 7 }, (_, i) => ({
      x: -170 + i * 52 + rnd() * 20,
      y: Math.tan((5 + rnd() * 7) * DEG) * 170,
      shape: i % CLOUD_SHAPES.length,
      scale: 1.1 + rnd() * 0.9,
      speed: 0.6 + rnd() * 0.6,
    }));
  }, []);

  useFrame(({ camera }, delta) => {
    const dt = Math.min(delta, 0.05);
    clouds.forEach((c, i) => {
      const g = refs.current[i];
      if (!g) return;
      if (animate) {
        c.x += c.speed * dt;
        if (c.x > 190) c.x = -190;
      }
      g.position.set(c.x, c.y, -170);
      g.lookAt(camera.position);
    });
  });

  return clouds.map((c, i) => (
    <group key={i} ref={(el) => (refs.current[i] = el)}>
      <Cloud shape={c.shape} scale={c.scale} />
    </group>
  ));
};

const Stars = ({ animate }) => {
  const twinkle = useRef();
  const [dim, bright] = useMemo(() => {
    const rnd = mulberry32(3);
    const make = (n) => {
      const pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const az = (rnd() * 150 - 75) * DEG;
        const el = (7.5 + Math.pow(rnd(), 0.8) * 40) * DEG;
        const r = 250;
        pos.set([Math.sin(az) * Math.cos(el) * r, Math.sin(el) * r, -Math.cos(az) * Math.cos(el) * r], i * 3);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      return g;
    };
    return [make(260), make(28)];
  }, []);

  useFrame(({ clock }) => {
    if (animate && twinkle.current) {
      twinkle.current.opacity = 0.55 + 0.45 * Math.sin(clock.elapsedTime * 2.3);
    }
  });

  return (
    <>
      <points geometry={dim}>
        <pointsMaterial color="#d8d0f0" size={1} sizeAttenuation={false} fog={false} />
      </points>
      <points geometry={bright}>
        <pointsMaterial ref={twinkle} color="#ffffff" size={2} sizeAttenuation={false} transparent fog={false} />
      </points>
    </>
  );
};

/** Everything infinitely far away: follows the camera so it never parallaxes. */
export const Sky = ({ animate }) => {
  const group = useRef();
  const skyTex = useMemo(makeSkyTexture, []);

  useFrame(({ camera }) => {
    group.current?.position.copy(camera.position);
  });

  return (
    <group ref={group}>
      <mesh renderOrder={-1}>
        <sphereGeometry args={[300, 48, 96]} />
        <meshBasicMaterial map={skyTex} side={THREE.BackSide} fog={false} depthWrite={false} />
      </mesh>
      <Stars animate={animate} />
      <Clouds animate={animate} />
      <Sun />
    </group>
  );
};

/* -------------------------------------------------------------- terrain -- */

const HILL_LAYERS = [
  // z, color, min height, max height, count
  [-160, C.hillNear, 9, 13, 9],
  [-135, C.hillMid, 8, 11, 10],
  [-112, C.hillFar, 6.5, 9, 12],
];

export const Hills = () => {
  const hills = useMemo(() => {
    const rnd = mulberry32(5);
    return HILL_LAYERS.flatMap(([z, color, hMin, hMax, n]) =>
      Array.from({ length: n }, (_, i) => ({
        color,
        x: -200 + (i + rnd() * 0.6) * (400 / n),
        z: z + rnd() * 8,
        w: 28 + rnd() * 26,
        h: hMin + rnd() * (hMax - hMin),
      }))
    );
  }, []);

  return hills.map((h, i) => (
    <mesh key={i} position={[h.x, 0, h.z]} scale={[h.w, h.h, 14]} material={flat(h.color)}>
      <sphereGeometry args={[1, 9, 5, 0, Math.PI * 2, 0, Math.PI / 2]} />
    </mesh>
  ));
};

// Ground strips get darker toward the horizon, in hard steps.
const GROUND_STRIPS = [
  [30, -14, C.grass],
  [-14, -26, "#3d5f49"],
  [-26, -40, C.grassDark],
  [-40, -58, "#304d40"],
  [-58, -200, "#2f4a42"],
];

export const Ground = () => (
  <>
    {GROUND_STRIPS.map(([z0, z1, color]) => (
      <mesh
        key={z0}
        geometry={unitBox}
        material={toon(color)}
        scale={[420, 0.2, z0 - z1]}
        position={[0, -0.1, (z0 + z1) / 2]}
      />
    ))}
  </>
);

export const Tufts = () => {
  const ref = useRef();
  const count = 420;

  useLayoutEffect(() => {
    const rnd = mulberry32(9);
    const m = new THREE.Object3D();
    const colors = [C.grassDark, C.grassDark, C.grassDeep, C.grassLight, "#4f7656"];
    const col = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const z = 12 - Math.pow(rnd(), 0.7) * 48;
      m.position.set(rnd() * 70 - 35, 0.02, z);
      m.scale.set(0.3 + rnd() * 0.7, 0.04, 0.2 + rnd() * 0.35);
      m.updateMatrix();
      ref.current.setMatrixAt(i, m.matrix);
      ref.current.setColorAt(i, col.set(colors[Math.floor(rnd() * colors.length)]));
    }
    ref.current.instanceMatrix.needsUpdate = true;
    ref.current.instanceColor.needsUpdate = true;
  }, []);

  return <instancedMesh ref={ref} args={[unitBox, toon("#ffffff"), count]} />;
};

export const Hedge = () => {
  const bushes = useMemo(() => {
    const rnd = mulberry32(21);
    return Array.from({ length: 46 }, (_, i) => ({
      x: -115 + i * 5 + rnd() * 3,
      h: 0.7 + rnd() * 1.1,
      w: 3 + rnd() * 4,
    }));
  }, []);
  return bushes.map((b, i) => (
    <Vox key={i} s={[b.w, b.h, 2]} p={[b.x, b.h / 2, -58]} c={C.hedge} unlit />
  ));
};

export const Fireflies = ({ animate }) => {
  const ref = useRef();
  const mat = useRef();
  const { geom, base } = useMemo(() => {
    const rnd = mulberry32(17);
    const n = 40;
    const b = Array.from({ length: n }, () => [rnd() * 30 - 15, 0.3 + rnd() * 1.4, rnd() * 22 - 15, rnd() * 10]);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    return { geom: g, base: b };
  }, []);

  useFrame(({ clock }) => {
    const t = animate ? clock.elapsedTime : 0;
    const pos = geom.attributes.position;
    base.forEach(([x, y, z, ph], i) => {
      pos.setXYZ(i, x + Math.sin(t * 0.4 + ph) * 0.8, y + Math.sin(t * 0.9 + ph * 2) * 0.25, z + Math.cos(t * 0.3 + ph) * 0.8);
    });
    pos.needsUpdate = true;
    if (mat.current) mat.current.opacity = 0.6 + 0.4 * Math.sin(t * 1.7);
  });

  return (
    <points ref={ref} geometry={geom}>
      <pointsMaterial ref={mat} color={C.lantern} size={1} sizeAttenuation={false} transparent />
    </points>
  );
};

/* ----------------------------------------------------------------- pen -- */


const fenceRun = (from, to, axis) => {
  // Posts every ~1.5 units along one axis-aligned edge, rails between them.
  const len = Math.abs(to[axis] - from[axis]);
  const n = Math.max(1, Math.round(len / 1.5));
  const posts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    posts.push([from.x + (to.x - from.x) * t, from.z + (to.z - from.z) * t]);
  }
  return { posts, mid: [(from.x + to.x) / 2, (from.z + to.z) / 2], len, axis };
};

const FenceRun = ({ run }) => (
  <>
    {run.posts.map(([x, z], i) => (
      <group key={i}>
        <Vox s={[0.2, 1.4, 0.2]} p={[x, 0.7, z]} c={C.wood} />
        <Vox s={[0.24, 0.08, 0.24]} p={[x, 1.42, z]} c={C.woodDark} />
      </group>
    ))}
    {[0.55, 1.05].map((y) => (
      <Vox
        key={y}
        s={run.axis === "x" ? [run.len, 0.13, 0.09] : [0.09, 0.13, run.len]}
        p={[run.mid[0], y, run.mid[1]]}
        c={C.woodLight}
      />
    ))}
  </>
);

export const Pen = () => {
  const { x0, x1, z0, z1, gateZ0, gateZ1 } = PEN;
  const runs = useMemo(
    () => [
      fenceRun({ x: x0, z: z0 }, { x: x1, z: z0 }, "x"),
      fenceRun({ x: x1, z: z0 }, { x: x1, z: z1 }, "z"),
      fenceRun({ x: x0, z: z1 }, { x: x1, z: z1 }, "x"),
      fenceRun({ x: x0, z: z0 }, { x: x0, z: gateZ0 }, "z"),
      fenceRun({ x: x0, z: gateZ1 }, { x: x0, z: z1 }, "z"),
    ],
    [x0, x1, z0, z1, gateZ0, gateZ1]
  );
  const gateLen = gateZ1 - gateZ0;

  return (
    <group>
      {/* trampled, lighter grass inside the pen */}
      <Vox s={[x1 - x0, 0.02, z1 - z0]} p={[(x0 + x1) / 2, 0.005, (z0 + z1) / 2]} c="#5a7348" />
      {runs.map((r, i) => (
        <FenceRun key={i} run={r} />
      ))}
      {/* gate, swung open toward the field */}
      <group position={[x0, 0, gateZ1]} rotation={[0, -1.1, 0]}>
        <Vox s={[0.09, 0.13, gateLen]} p={[0, 0.55, -gateLen / 2]} c={C.woodLight} />
        <Vox s={[0.09, 0.13, gateLen]} p={[0, 1.05, -gateLen / 2]} c={C.woodLight} />
        <Vox s={[0.16, 1.2, 0.16]} p={[0, 0.65, -gateLen]} c={C.wood} />
      </group>
      {/* lantern post by the gate */}
      <Vox s={[0.16, 2.1, 0.16]} p={[x0 - 0.5, 1.05, gateZ1 + 1.2]} c={C.woodDark} />
      <Vox s={[0.5, 0.1, 0.1]} p={[x0 - 0.3, 2.05, gateZ1 + 1.2]} c={C.woodDark} />
      <Vox s={[0.26, 0.32, 0.26]} p={[x0 - 0.12, 1.8, gateZ1 + 1.2]} c={C.lantern} unlit />
      <pointLight color={C.lantern} intensity={1.2} distance={7} position={[x0 - 0.12, 1.8, gateZ1 + 1.2]} />
    </group>
  );
};
