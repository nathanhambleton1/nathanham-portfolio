import React, { useRef, useEffect, Suspense, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF, Environment } from '@react-three/drei';
import * as THREE from 'three';

// Path to model in public folder
const MODEL_PATH = '/Liquorbot_model.glb';

interface LiquorBotProps {
  className?: string;
  initialYaw?: number;    // left/right (Y axis)
  initialPitch?: number;  // up/down (X axis)
  initialRoll?: number;   // tilt (Z axis)
  yawAmplitude?: number;  // parallax strength horizontally
  pitchAmplitude?: number;// parallax strength vertically
  lerpFactor?: number;    // smoothing
}

const LiquorBot: React.FC<LiquorBotProps> = ({
  initialYaw = Math.PI / 10,
  initialPitch = 0.08,
  initialRoll = 0,
  yawAmplitude = 0.6,
  pitchAmplitude = 0.4,
  lerpFactor = 0.05
}) => {
  const group = useRef<THREE.Group>(null);
  const baseRot = useRef(new THREE.Euler(initialPitch, initialYaw, initialRoll));
  const { scene } = useGLTF(MODEL_PATH);
  const cloned = useMemo(() => scene.clone(true), [scene]);

  useEffect(() => {
    if (!group.current) return;
    const box = new THREE.Box3().setFromObject(cloned);
    const center = new THREE.Vector3();
    box.getCenter(center);
    cloned.position.sub(center);

    // Set group to base rotation immediately (so no pop on first frame)
    group.current.rotation.copy(baseRot.current);
  }, [cloned]);

  const { size } = useThree();
  // Increased base scale to make the model fill more of its container
  const base = 6.8;
  const responsiveFactor = Math.min(size.width / 800, 1.1);
  const scale = base * responsiveFactor;

  const mouse = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth) * 2 - 1;
      const y = (e.clientY / window.innerHeight) * 2 - 1;
      mouse.current = { x, y };
    };
    window.addEventListener('mousemove', handleMove);
    return () => window.removeEventListener('mousemove', handleMove);
  }, []);

  useFrame(() => {
    if (!group.current) return;
    const base = baseRot.current;

    const targetYaw = base.y + mouse.current.x * yawAmplitude;
  // Inverted vertical response: moving mouse down (y positive) now tilts model forward
  const targetPitch = base.x + mouse.current.y * pitchAmplitude;
    const targetRoll = base.z; // keep roll fixed (or add mouse.current.x * someFactor)

    group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, targetYaw, lerpFactor);
    group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, targetPitch, lerpFactor);
    group.current.rotation.z = THREE.MathUtils.lerp(group.current.rotation.z, targetRoll, lerpFactor);
  });

  return (
    <group ref={group} scale={[scale, scale, scale]}>
      <primitive object={cloned} />
    </group>
  );
};

useGLTF.preload(MODEL_PATH);

const LiquorBotModelCanvas: React.FC<LiquorBotProps> = (props) => {
  return (
    <div className={props.className} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Canvas
        camera={{ position: [0.8, 1.4, 2.6], fov: 38 }}
        style={{ width: '100%', height: '100%' }}
        gl={{ alpha: true, antialias: true }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 8, 5]} intensity={1.1} />
        <directionalLight position={[-4, 3, -2]} intensity={0.35} />
        <directionalLight position={[0, 6, 0]} intensity={0.25} />
        <Suspense fallback={null}>
          {/* Adjusted: lean model back (negative pitch) and slightly reduce vertical motion */}
          <LiquorBot
            initialYaw={Math.PI * 4}   // increased yaw (was PI/12) to turn more left from viewer perspective
            initialPitch={-0.22}       // more backward lean (was -0.17)
            initialRoll={0.02}
            yawAmplitude={0.5}
            pitchAmplitude={0.26}     // slightly reduced to keep vertical motion subtle around new base
            lerpFactor={0.07}
          />
          <Environment preset="city" />
        </Suspense>
        <OrbitControls enableZoom={false} enablePan={false} enableRotate={false} />
      </Canvas>
    </div>
  );
};

export default LiquorBotModelCanvas;
