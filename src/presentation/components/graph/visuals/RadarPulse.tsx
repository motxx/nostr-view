import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useActivityStore } from "@/store/activity-store";
import { pulsePeriod } from "@/lib/graph-math";

export function RadarPulse({
  radius,
  color,
  nodeId,
}: {
  radius: number;
  color: string;
  nodeId?: string;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const ringCount = 3;

  const rings = useMemo(() => {
    const arr: THREE.Line[] = [];
    for (let r = 0; r < ringCount; r++) {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 64; i++) {
        const a = (i / 64) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a), 0, Math.sin(a)));
      }
      const geom = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
      });
      const line = new THREE.Line(geom, mat);
      line.userData.phaseOffset = r / ringCount;
      arr.push(line);
    }
    return arr;
  }, [color, ringCount]);

  useFrame(() => {
    if (!groupRef.current) return;

    // Three.js objects returned from useMemo are our own mutable scene objects.
    // Mutating scale/material per frame is the standard R3F pattern.
    /* eslint-disable react-hooks/immutability -- Three.js object mutation in useFrame */

    // Determine pulse speed from activity
    let period = 3; // default moderate speed
    if (nodeId) {
      const lastPost = useActivityStore.getState().lastPostTime.get(nodeId);
      if (lastPost) {
        const p = pulsePeriod(lastPost, Date.now() / 1000);
        if (p > 0) period = p;
      }
    }

    const now = Date.now() / 1000;
    for (const ring of rings) {
      const phase = ring.userData.phaseOffset as number;
      const t = ((now / period + phase) % 1);
      const scale = t * radius;
      ring.scale.set(scale, scale, scale);
      const mat = ring.material as THREE.LineBasicMaterial;
      mat.opacity = (1 - t) * 0.4;
    }
    /* eslint-enable react-hooks/immutability */
  });

  return (
    <group ref={groupRef}>
      {rings.map((ring, i) => (
        <primitive key={i} object={ring} />
      ))}
    </group>
  );
}
