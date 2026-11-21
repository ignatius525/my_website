import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import { PALETTE as C, Vox } from "./voxel";
import { Sheep, Dog, Shepherd } from "./Characters";
import { Sky, Hills, Hedge, Ground, Tufts, Fireflies, Pen } from "./Landscape";
import { createWorld, stepWorld, commandHerd } from "./herd";

// A voxel pasture at dusk, rendered at low resolution and upscaled with hard
// pixels (see .pixelated in index.css) so the 3D scene reads as 16-bit art.
// Behaviour (sheep, dogs, shepherds) lives in herd.js.

const Herd = ({ world, animate }) => {
  useFrame((_, delta) => {
    if (animate) stepWorld(world, delta);
  });

  return (
    <>
      {world.shepherds.map((s) => (
        <Shepherd key={s.seed} brain={s} />
      ))}
      {world.sheep.map((b, i) => (
        <Sheep key={i} brain={b} />
      ))}
      {world.dogs.map((d, i) => (
        <Dog key={i} brain={d} />
      ))}
    </>
  );
};

/**
 * Click/tap the field to send the dogs there. One listener on the canvas and
 * an analytic ray vs. ground-plane hit (no meshes, no per-move raycasting).
 */
const ClickToHerd = ({ world, onCommand }) => {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);

  useEffect(() => {
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();
    const el = gl.domElement;

    const onClick = (e) => {
      const r = el.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      if (!raycaster.ray.intersectPlane(ground, hit)) return; // clicked the sky
      commandHerd(world, hit.x, hit.z);
      onCommand?.();
    };
    el.addEventListener("click", onClick);
    return () => el.removeEventListener("click", onClick);
  }, [gl, camera, world, onCommand]);

  return null;
};

/**
 * A pixel target where the dogs were sent: pops in, stays while they run
 * there (so the click and the dogs read as connected), then shrinks away.
 */
const ClickMarker = ({ world }) => {
  const ref = useRef();
  const fade = useRef(1);
  useFrame((_, delta) => {
    const g = ref.current;
    const cmd = world.command;
    if (!cmd) return;
    const age = world.time - cmd.at;
    const going = world.dogs.some((d) => d.mode === "command" && d.cmdPhase === "go");
    fade.current = going || age < 0.6 ? 1 : Math.max(0, fade.current - delta / 0.5);
    g.visible = fade.current > 0;
    if (!g.visible) return;
    g.position.set(cmd.x, 0.03, cmd.z);
    const pop = age < 0.12 ? (age / 0.12) * 1.3 : age < 0.25 ? 1.3 - ((age - 0.12) / 0.13) * 0.3 : 1;
    g.scale.setScalar(pop * fade.current);
  });
  return (
    <group ref={ref} visible={false}>
      <Vox s={[1.2, 0.04, 0.2]} p={[0, 0, 0.6]} c={C.sun} unlit />
      <Vox s={[1.2, 0.04, 0.2]} p={[0, 0, -0.6]} c={C.sun} unlit />
      <Vox s={[0.2, 0.04, 1.2]} p={[0.6, 0, 0]} c={C.sun} unlit />
      <Vox s={[0.2, 0.04, 1.2]} p={[-0.6, 0, 0]} c={C.sun} unlit />
      <Vox s={[0.25, 0.05, 0.25]} p={[0, 0, 0]} c={C.ember} unlit />
    </group>
  );
};

// How far the cursor can swing the camera around the scene.
const MAX_YAW = 0.42; // radians (~24 degrees) each way
const MAX_LIFT = 1.6; // world units up/down

/** Frames the scene for the viewport; the cursor orbits the camera around the flock. */
const CameraRig = () => {
  const size = useThree((s) => s.size);
  const yaw = useRef(0);
  const lift = useRef(0);

  useFrame(({ camera, pointer }) => {
    const portrait = size.width / size.height < 1;
    const base = portrait
      ? { x: -3.5, y: 7.5, z: 25, fov: 50, tx: -3, ty: 3, tz: -10 }
      : { x: 0, y: 6, z: 18, fov: 40, tx: 0, ty: 3, tz: -12 };
    if (camera.fov !== base.fov) {
      camera.fov = base.fov;
      camera.updateProjectionMatrix();
    }
    // Ease toward the cursor so the swing feels weighty, not twitchy.
    yaw.current += (pointer.x * MAX_YAW - yaw.current) * 0.04;
    lift.current += (pointer.y * MAX_LIFT - lift.current) * 0.04;

    // Orbit the base position around the look-at target.
    const ox = base.x - base.tx;
    const oz = base.z - base.tz;
    const c = Math.cos(yaw.current);
    const s = Math.sin(yaw.current);
    camera.position.set(
      base.tx + ox * c + oz * s,
      base.y + lift.current,
      base.tz - ox * s + oz * c
    );
    camera.lookAt(base.tx, base.ty, base.tz);
  });
  return null;
};

const Scene = ({ animate, onCommand }) => {
  const world = useMemo(createWorld, []);
  return (
  <>
    <hemisphereLight args={["#a796c8", C.grass, 0.85]} />
    <directionalLight color="#ffd9b0" intensity={1.0} position={[8, 14, 12]} />
    <ambientLight color="#3a2956" intensity={0.3} />

    <Sky animate={animate} />
    <Hills />
    <Hedge />
    <Ground />
    <Tufts />
    <Fireflies animate={animate} />
    <Pen />
    <Herd world={world} animate={animate} />
    {animate && <ClickMarker world={world} />}
    {animate && <ClickToHerd world={world} onCommand={onCommand} />}
    <CameraRig />
  </>
  );
};

const PastureCanvas = () => {
  const wrap = useRef();
  const [visible, setVisible] = useState(true);
  // Read media queries up front so reduced-motion users never see a flash of the hint.
  const [reduced, setReduced] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [touch] = useState(() => window.matchMedia("(pointer: coarse)").matches);
  const [pixel, setPixel] = useState(4);
  const [herded, setHerded] = useState(false);

  // Stable callback: hides the hint after the first command.
  const onCommand = useCallback(() => setHerded(true), []);

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
    io.observe(wrap.current);

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotion = () => setReduced(motion.matches);
    onMotion();
    motion.addEventListener("change", onMotion);

    // Chunky 4px "art pixels" on desktop, 3px on phones so sheep stay legible.
    const onResize = () => setPixel(window.innerWidth < 640 ? 3 : 4);
    onResize();
    window.addEventListener("resize", onResize);

    return () => {
      io.disconnect();
      motion.removeEventListener("change", onMotion);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <div
      ref={wrap}
      className={`absolute inset-0 pixelated touch-manipulation
      [-webkit-tap-highlight-color:transparent] ${reduced ? "" : "cursor-crosshair"}`}
      aria-hidden="true"
    >
      <Canvas
        flat
        dpr={1 / pixel}
        frameloop={visible && !reduced ? "always" : "demand"}
        camera={{ position: [0, 6, 18], fov: 40, near: 0.5, far: 1000 }}
        gl={{ antialias: false, powerPreference: "high-performance" }}
      >
        <Scene animate={!reduced} onCommand={onCommand} />
      </Canvas>
      {!reduced && (
        <p
          // Centered just above the scroll indicator (its bottom offset + 60px + gap).
          className={`absolute inset-x-0 text-center px-6 bottom-[208px] xs:bottom-[120px]
          z-10 pointer-events-none text-wool-light text-[15px] pixel-shadow
          transition-opacity duration-700 ${herded ? "opacity-0" : "opacity-90"}`}
        >
          {touch ? "Tap" : "Click"} the field to send the dogs
        </p>
      )}
    </div>
  );
};

export default PastureCanvas;
