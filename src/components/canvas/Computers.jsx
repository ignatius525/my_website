import { Suspense, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Preload, useGLTF } from '@react-three/drei';

import CanvasLoader from '../Loader';

const Computers = () => {
  const computer = useGLTF('./pixel_low_poly_spaceship/scene.gltf')

  return (
    <mesh>
      <hemisphereLight intensity={0.05}
      groundColor="black" />
      <pointLight intensity={1} />
      <primitive object={computer.scene} 
       scale={1}
       position={[5,2.25, 1.5]}
       rotation={[-0.01, -0.2, -0.1]} 
      />
    </mesh>
  )
}

const ComputersCanvas = () => {
  return (
    <Canvas
      frameloop="demand"
      shadows
      camera={{ position: [20, 3, 5], fov: 25}}
      gl={{ preserveDrawingBuffer: true }}>
        <Suspense fallback={<CanvasLoader />}>
          <OrbitControls 
           enableZoom={false} 
           maxPolarAngle={Math.PI / 2}
           minPolarAngle={Math.PI / 2}
          />
          <Computers />
        </Suspense>

        <Preload all />
    </Canvas>
  )
}

export default ComputersCanvas;