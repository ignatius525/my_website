import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";

import { PALETTE as C } from "./voxel";
import { Sheep, Dog, Shepherd } from "./Characters";
import { Sky, Hills, Hedge, Ground, Tufts, Fireflies, Pen } from "./Landscape";
import { createWorld, stepWorld } from "./herd";

// A voxel pasture at dusk, rendered at low resolution and upscaled with hard
// pixels (see .pixelated in index.css) so the 3D scene reads as 16-bit art.
// Behaviour (sheep, dogs, shepherds) lives in herd.js.

const Herd = ({ animate }) => {
  const world = useMemo(createWorld, []);

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

const Scene = ({ animate }) => (
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
    <Herd animate={animate} />
    <CameraRig />
  </>
);

const PastureCanvas = () => {
  const wrap = useRef();
  const [visible, setVisible] = useState(true);
  const [reduced, setReduced] = useState(false);
  const [pixel, setPixel] = useState(4);

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
    <div ref={wrap} className="absolute inset-0 pixelated" aria-hidden="true">
      <Canvas
        flat
        dpr={1 / pixel}
        frameloop={visible && !reduced ? "always" : "demand"}
        camera={{ position: [0, 6, 18], fov: 40, near: 0.5, far: 1000 }}
        gl={{ antialias: false, powerPreference: "high-performance" }}
      >
        <Scene animate={!reduced} />
      </Canvas>
    </div>
  );
};

export default PastureCanvas;
