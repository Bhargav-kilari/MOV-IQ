import React, { Suspense, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Center, Html } from '@react-three/drei';
import {
  RotateCcw,
  Play,
  Pause,
  Layers,
  Box,
} from 'lucide-react';

const MuscleAnatomyFigure = ({ isWireframe = false, isPlaying = true }) => {
  const groupRef = useRef();

  useFrame((state, delta) => {
    if (groupRef.current && isPlaying) {
      groupRef.current.rotation.y += delta * 0.4;
    }
  });

  return (
    <group ref={groupRef} position={[0, -0.2, 0]}>
      {/* Torso */}
      <mesh position={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.4, 0.3, 0.9, 16]} />
        <meshStandardMaterial
          color="#111111"
          wireframe={isWireframe}
          metalness={0.2}
          roughness={0.4}
        />
      </mesh>

      {/* Head */}
      <mesh position={[0, 1.1, 0]}>
        <sphereGeometry args={[0.22, 16, 16]} />
        <meshStandardMaterial
          color="#222222"
          wireframe={isWireframe}
          metalness={0.2}
          roughness={0.3}
        />
      </mesh>

      {/* Deltoids & Arms */}
      <mesh position={[-0.52, 0.45, 0]} rotation={[0, 0, Math.PI / 8]}>
        <cylinderGeometry args={[0.12, 0.1, 0.75, 12]} />
        <meshStandardMaterial color="#333333" wireframe={isWireframe} />
      </mesh>
      <mesh position={[0.52, 0.45, 0]} rotation={[0, 0, -Math.PI / 8]}>
        <cylinderGeometry args={[0.12, 0.1, 0.75, 12]} />
        <meshStandardMaterial color="#333333" wireframe={isWireframe} />
      </mesh>

      {/* Barbell representation */}
      <mesh position={[0, 0.35, 0.45]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.035, 0.035, 1.8, 12]} />
        <meshStandardMaterial color="#555555" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[-0.75, 0.35, 0.45]}>
        <cylinderGeometry args={[0.18, 0.18, 0.05, 16]} />
        <meshStandardMaterial color="#111111" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[0.75, 0.35, 0.45]}>
        <cylinderGeometry args={[0.18, 0.18, 0.05, 16]} />
        <meshStandardMaterial color="#111111" metalness={0.8} roughness={0.3} />
      </mesh>

      {/* Legs */}
      <mesh position={[-0.2, -0.5, 0]}>
        <cylinderGeometry args={[0.14, 0.11, 0.9, 12]} />
        <meshStandardMaterial color="#222222" wireframe={isWireframe} />
      </mesh>
      <mesh position={[0.2, -0.5, 0]}>
        <cylinderGeometry args={[0.14, 0.11, 0.9, 12]} />
        <meshStandardMaterial color="#222222" wireframe={isWireframe} />
      </mesh>
    </group>
  );
};

export const ExerciseViewer3D = ({
  modelUrl = null,
  animationUrl = null,
  exerciseName = 'Demonstration',
  className = 'h-80 w-full',
}) => {
  const [isPlaying, setIsPlaying] = useState(true);
  const [isWireframe, setIsWireframe] = useState(false);
  const [cameraKey, setCameraKey] = useState(0);

  const handleReset = () => {
    setCameraKey((k) => k + 1);
  };

  return (
    <div className={`relative bg-[#F9FAFB] rounded-2xl overflow-hidden border border-[#E5E7EB] ${className}`}>
      {/* Top Left Badge */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2 bg-[#FFFFFF]/90 backdrop-blur border border-[#E5E7EB] px-2.5 py-1 rounded-lg text-[11px] text-[#111111] font-bold shadow-xs">
        <Box className="w-3.5 h-3.5 text-[#111111]" />
        <span>{exerciseName}</span>
      </div>

      {/* Top Right Controls */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1 bg-[#FFFFFF]/90 backdrop-blur border border-[#E5E7EB] p-1 rounded-xl shadow-xs">
        <button
          type="button"
          onClick={() => setIsPlaying(!isPlaying)}
          title={isPlaying ? 'Pause Rotation' : 'Play Rotation'}
          className={`p-1.5 rounded-lg text-xs transition ${
            isPlaying ? 'text-[#111111] bg-[#F3F4F6]' : 'text-[#6B7280] hover:text-[#111111]'
          }`}
        >
          {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
        </button>

        <button
          type="button"
          onClick={() => setIsWireframe(!isWireframe)}
          title="Toggle Wireframe"
          className={`p-1.5 rounded-lg text-xs transition ${
            isWireframe ? 'text-[#111111] bg-[#F3F4F6]' : 'text-[#6B7280] hover:text-[#111111]'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={handleReset}
          title="Reset Camera"
          className="p-1.5 text-[#6B7280] hover:text-[#111111] rounded-lg transition"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Orbit Tip */}
      <div className="absolute bottom-2.5 right-3 z-10 text-[10px] text-[#6B7280] bg-[#FFFFFF]/90 backdrop-blur px-2 py-0.5 rounded border border-[#E5E7EB] pointer-events-none">
        Drag to orbit · Scroll to zoom
      </div>

      {/* Three.js Canvas */}
      <Canvas
        key={cameraKey}
        shadows
        camera={{ position: [0, 0.7, 3.2], fov: 45 }}
        className="w-full h-full cursor-grab active:cursor-grabbing"
      >
        <ambientLight intensity={0.9} />
        <directionalLight position={[4, 8, 4]} intensity={1.5} />
        <directionalLight position={[-4, -4, -4]} intensity={0.5} />

        <Suspense
          fallback={
            <Html center>
              <div className="text-xs text-[#6B7280] font-semibold">Loading asset...</div>
            </Html>
          }
        >
          <Center>
            <MuscleAnatomyFigure isWireframe={isWireframe} isPlaying={isPlaying} />
          </Center>
          <OrbitControls
            enablePan={false}
            maxPolarAngle={Math.PI / 2 + 0.2}
            minDistance={1.8}
            maxDistance={5}
          />
        </Suspense>
      </Canvas>
    </div>
  );
};

export default ExerciseViewer3D;
