"use client";

import { Canvas } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { ForceGraphScene } from "./ForceGraphScene";

export function UniverseGraph() {
  return (
    <div className="w-full h-full">
      <Canvas
        camera={{ position: [0, 0, 500], fov: 60 }}
        gl={{ antialias: true }}
        style={{ background: "#000008" }}
      >
        <fog attach="fog" args={[0x000008, 100, 2000]} />
        <ambientLight intensity={0.6} />
        <Stars radius={1500} depth={50} count={2000} factor={4} fade speed={0.5} />
        <ForceGraphScene />
        <EffectComposer>
          <Bloom
            luminanceThreshold={0.9}
            luminanceSmoothing={0.025}
            intensity={0.35}
          />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
