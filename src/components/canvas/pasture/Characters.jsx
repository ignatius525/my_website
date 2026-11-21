import { useRef } from "react";
import { useFrame } from "@react-three/fiber";

import { PALETTE as C, Vox, BlobShadow } from "./voxel";

// Characters are built from voxels, facing +x (sheep, dog) or +z (shepherd).
// All motion state lives in "brain" objects updated by herd.js; these
// components only pose the meshes from those values each frame.

const legSwing = (legs, phase, amount) => {
  // Diagonal pairs move together, like a real trot.
  const s = Math.sin(phase) * amount;
  return [s, -s, -s, s];
};

/* --------------------------------------------------------------- sheep -- */

const SHEEP_LEGS = [
  [0.4, 0.55, 0.26],
  [0.4, 0.55, -0.26],
  [-0.4, 0.55, 0.26],
  [-0.4, 0.55, -0.26],
];

export const Sheep = ({ brain }) => {
  const root = useRef();
  const body = useRef();
  const head = useRef();
  const legs = useRef([]);

  useFrame(() => {
    if (!root.current) return;
    root.current.position.set(brain.x, 0, brain.z);
    root.current.rotation.y = -brain.h;
    const swing = legSwing(legs.current, brain.phase, 0.55 * brain.moving);
    legs.current.forEach((l, i) => l && (l.rotation.z = swing[i]));
    body.current.position.y = Math.abs(Math.sin(brain.phase)) * 0.06 * brain.moving + brain.hop;
    head.current.rotation.z = -1.0 * brain.graze;
    head.current.rotation.y = brain.look;
    head.current.position.y = 1.05 - 0.3 * brain.graze;
  });

  return (
    <group ref={root}>
      <BlobShadow w={1.7} d={1.15} />
      {SHEEP_LEGS.map((p, i) => (
        <group key={i} position={p} ref={(el) => (legs.current[i] = el)}>
          <Vox s={[0.16, 0.55, 0.16]} p={[0, -0.27, 0]} c={C.sheepDark} />
        </group>
      ))}
      <group ref={body}>
        {/* overlapping boxes notch the corners -> a round, fluffy pixel body */}
        <Vox s={[1.34, 0.66, 0.96]} p={[0, 0.92, 0]} c={C.wool} />
        <Vox s={[1.12, 0.9, 0.78]} p={[0, 0.94, 0]} c={C.wool} />
        <Vox s={[0.9, 0.12, 0.58]} p={[-0.02, 1.43, 0]} c={C.woolLight} />
        <Vox s={[0.5, 0.1, 0.4]} p={[0.15, 1.5, 0]} c={C.woolLight} />
        <group ref={head} position={[0.78, 1.05, 0]}>
          <Vox s={[0.42, 0.48, 0.42]} p={[0.06, 0, 0]} c={C.sheepDark} />
          <Vox s={[0.1, 0.08, 0.24]} p={[-0.06, 0.12, 0.29]} c={C.sheepDark} />
          <Vox s={[0.1, 0.08, 0.24]} p={[-0.06, 0.12, -0.29]} c={C.sheepDark} />
          <Vox s={[0.05, 0.09, 0.09]} p={[0.27, 0.07, 0.12]} c={C.woolLight} unlit />
          <Vox s={[0.05, 0.09, 0.09]} p={[0.27, 0.07, -0.12]} c={C.woolLight} unlit />
          <Vox s={[0.26, 0.12, 0.36]} p={[-0.04, 0.28, 0]} c={C.woolLight} />
        </group>
      </group>
    </group>
  );
};

/* ----------------------------------------------------------------- dog -- */

const DOG_LEGS = [
  [0.36, 0.48, 0.12], // front
  [0.36, 0.48, -0.12],
  [-0.36, 0.48, 0.12], // back
  [-0.36, 0.48, -0.12],
];
const HIP = [-0.4, 0.5, 0]; // the dog sits by pivoting its body around the hip
const SIT_TILT = 0.5;

/** Comic-style "!" bubble that pops up over a barking dog. Faces the camera. */
const BarkBubble = ({ brain }) => {
  const ref = useRef();
  useFrame(({ camera }) => {
    const g = ref.current;
    if (!g) return;
    const age = brain.barkAge;
    const visible = brain.barking;
    g.visible = visible;
    if (!visible) return;
    // Pop in with a little overshoot, hold, then shrink away.
    const t = age / 0.6;
    const s = t < 0.2 ? 1.25 * Math.sin((t / 0.2) * (Math.PI / 2)) : t > 0.85 ? (1 - t) / 0.15 : 1;
    g.scale.setScalar(Math.max(0.01, s));
    const fx = Math.cos(brain.h);
    const fz = Math.sin(brain.h);
    g.position.set(brain.x + fx * 0.5, 1.75 + 0.3 * brain.sit, brain.z + fz * 0.5);
    g.quaternion.copy(camera.quaternion);
  });

  return (
    <group ref={ref} visible={false}>
      <group position={[0.35, 0.35, 0]}>
        {/* outline, fill, tail */}
        <Vox s={[1.0, 0.86, 0.02]} p={[0, 0, 0]} c={C.sheepDark} unlit />
        <Vox s={[0.86, 0.72, 0.03]} p={[0, 0, 0.01]} c={C.woolLight} unlit />
        <Vox s={[0.26, 0.24, 0.02]} p={[-0.26, -0.48, 0]} c={C.sheepDark} unlit />
        <Vox s={[0.13, 0.16, 0.03]} p={[-0.26, -0.42, 0.01]} c={C.woolLight} unlit />
        {/* the "!" */}
        <Vox s={[0.15, 0.34, 0.04]} p={[0, 0.09, 0.02]} c={C.redShirt} unlit />
        <Vox s={[0.15, 0.12, 0.04]} p={[0, -0.22, 0.02]} c={C.redShirt} unlit />
      </group>
    </group>
  );
};

export const Dog = ({ brain }) => {
  const root = useRef();
  const hip = useRef();
  const head = useRef();
  const tail = useRef();
  const legs = useRef([]);
  const { main, white } = brain.coat;

  useFrame((state) => {
    if (!root.current) return;
    const t = state.clock.elapsedTime;
    const sit = brain.sit;
    root.current.position.set(brain.x, 0, brain.z);
    root.current.rotation.y = -brain.h;

    // Sitting: tilt the body up around the hip and drop it a little.
    const tilt = SIT_TILT * sit;
    const barkKick = brain.barking ? Math.max(0, 1 - brain.barkAge / 0.18) : 0;
    hip.current.rotation.z = tilt;
    hip.current.position.y = HIP[1] - 0.22 * sit + Math.abs(Math.sin(brain.phase)) * 0.08 * brain.moving + barkKick * 0.06;

    const swing = legSwing(legs.current, brain.phase, 0.8 * brain.moving * (1 - sit));
    legs.current.forEach((l, i) => {
      if (!l) return;
      if (i < 2) {
        // front legs stay vertical and stretch to reach the ground
        l.rotation.z = swing[i] - tilt;
        l.scale.y = 1 + 0.33 * sit;
      } else {
        // back legs fold forward under the body
        l.rotation.z = swing[i] + 0.7 * sit;
      }
    });

    tail.current.rotation.z = 0.5 - 0.6 * sit + Math.sin(t * (brain.moving > 0.3 ? 6 : 10)) * 0.25;
    tail.current.rotation.y = Math.sin(t * 9) * (brain.moving > 0.3 ? 0.1 : 0.45);
    // Keep the head level while sitting; jerk it up on each bark.
    head.current.rotation.z = -tilt + barkKick * 0.45;
    head.current.rotation.y = brain.moving > 0.3 || brain.barking ? 0 : Math.sin(t * 0.7 + brain.angle) * 0.5;
  });

  return (
    <>
      <group ref={root}>
        <BlobShadow w={1.4} d={0.6} />
        <group ref={hip} position={HIP}>
          <group position={[-HIP[0], -HIP[1], 0]}>
            {DOG_LEGS.map((p, i) => (
              <group key={i} position={p} ref={(el) => (legs.current[i] = el)}>
                <Vox s={[0.12, 0.22, 0.12]} p={[0, -0.11, 0]} c={main} />
                <Vox s={[0.12, 0.25, 0.12]} p={[0, -0.34, 0]} c={white} />
              </group>
            ))}
            <Vox s={[1.0, 0.38, 0.36]} p={[0, 0.64, 0]} c={main} />
            <Vox s={[0.3, 0.36, 0.38]} p={[0.4, 0.58, 0]} c={white} />
            <group ref={head} position={[0.6, 0.95, 0]}>
              <Vox s={[0.36, 0.32, 0.32]} p={[0, 0, 0]} c={main} />
              <Vox s={[0.3, 0.34, 0.1]} p={[0.04, 0.005, 0]} c={white} />
              <Vox s={[0.2, 0.14, 0.2]} p={[0.25, -0.08, 0]} c={white} />
              <Vox s={[0.06, 0.06, 0.08]} p={[0.36, -0.03, 0]} c={C.sheepDark} />
              <Vox s={[0.08, 0.14, 0.08]} p={[-0.08, 0.21, 0.11]} c={main} />
              <Vox s={[0.08, 0.14, 0.08]} p={[-0.08, 0.21, -0.11]} c={main} />
            </group>
            <group ref={tail} position={[-0.5, 0.74, 0]}>
              <Vox s={[0.45, 0.1, 0.1]} p={[-0.2, 0, 0]} c={main} />
              <Vox s={[0.12, 0.11, 0.11]} p={[-0.45, 0, 0]} c={white} />
            </group>
          </group>
        </group>
      </group>
      <BarkBubble brain={brain} />
    </>
  );
};

/* ------------------------------------------------------------ shepherd -- */

const CROOK_HOOK = [
  [0.21, 0.98],
  [0.31, 1.04],
  [0.41, 1.01],
  [0.47, 0.92],
  [0.47, 0.82],
];

export const Shepherd = ({ brain }) => {
  const root = useRef();
  const torso = useRef();
  const head = useRef();
  const legL = useRef();
  const legR = useRef();
  const armL = useRef();
  const armR = useRef();
  const { shirt } = brain;

  useFrame((state) => {
    if (!root.current) return;
    const t = state.clock.elapsedTime + brain.seed * 10;
    root.current.position.set(brain.x, 0, brain.z);
    root.current.rotation.y = brain.yaw;

    // Model faces +z, so legs and arms swing around the x axis.
    const swing = Math.sin(brain.phase) * 0.6 * brain.moving;
    legL.current.rotation.x = swing;
    legR.current.rotation.x = -swing;
    armL.current.rotation.x = -swing * 0.8;
    // Right arm carries the crook: a small swing when walking, hoisted when signalling.
    armR.current.position.y = 1.7 + 0.35 * brain.raise;
    armR.current.rotation.x = swing * 0.25 - 0.35 * brain.raise;
    armR.current.rotation.z = 0.15 * brain.raise;

    torso.current.position.y =
      Math.abs(Math.sin(brain.phase)) * 0.05 * brain.moving + Math.sin(t * 1.6) * 0.02 * (1 - brain.moving);
    head.current.rotation.y += (brain.look - head.current.rotation.y) * 0.08;
  });

  return (
    <group ref={root}>
      <BlobShadow w={1.1} d={0.8} />
      {[
        [legL, -0.16],
        [legR, 0.16],
      ].map(([ref, x]) => (
        <group key={x} ref={ref} position={[x, 0.95, 0]}>
          <Vox s={[0.24, 0.75, 0.26]} p={[0, -0.38, 0]} c={C.navy} />
          <Vox s={[0.24, 0.2, 0.32]} p={[0, -0.85, 0.04]} c={C.boots} />
        </group>
      ))}
      <group ref={torso}>
        <Vox s={[0.66, 0.8, 0.38]} p={[0, 1.33, 0]} c={shirt} />
        <Vox s={[0.68, 0.1, 0.4]} p={[0, 0.98, 0]} c={C.woodDark} />
        <group ref={armL} position={[-0.43, 1.7, 0]}>
          <Vox s={[0.2, 0.7, 0.24]} p={[0, -0.33, 0]} c={shirt} />
          <Vox s={[0.2, 0.16, 0.22]} p={[0, -0.76, 0]} c={C.skin} />
        </group>
        <group ref={armR} position={[0.45, 1.7, 0]}>
          <Vox s={[0.2, 0.62, 0.24]} p={[0, -0.3, 0.06]} c={shirt} rot={[-0.35, 0, 0]} />
          <Vox s={[0.2, 0.16, 0.22]} p={[0.02, -0.6, 0.2]} c={C.skin} />
          {/* shepherd's crook */}
          <Vox s={[0.09, 2.6, 0.09]} p={[0.17, -0.4, 0.22]} c={C.woodLight} />
          {CROOK_HOOK.map(([x, y]) => (
            <Vox key={x + y} s={[0.1, 0.1, 0.1]} p={[x, y, 0.22]} c={C.woodLight} />
          ))}
        </group>
        <group ref={head} position={[0, 1.98, 0]}>
          <Vox s={[0.5, 0.5, 0.46]} p={[0, 0, 0]} c={C.skin} />
          <Vox s={[0.07, 0.09, 0.02]} p={[0.11, 0.02, 0.235]} c={C.sheepDark} unlit />
          <Vox s={[0.07, 0.09, 0.02]} p={[-0.11, 0.02, 0.235]} c={C.sheepDark} unlit />
          <Vox s={[0.56, 0.2, 0.52]} p={[0, 0.3, 0]} c={C.navy} />
          <Vox s={[0.56, 0.06, 0.22]} p={[0, 0.22, 0.33]} c={C.navy} />
        </group>
      </group>
    </group>
  );
};
