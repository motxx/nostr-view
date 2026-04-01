import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useUIStore } from "@/store/ui-store";
import { useActivityStore } from "@/store/activity-store";
import {
  spawnParticles,
  advanceParticles,
  lerp,
  type Particle,
  type EdgeEndpoints,
} from "@/lib/edge-particles";
import type { SimState } from "./graph-types";

const MAX_PARTICLES = 200;

/** Circular glow texture for particles (module-level, created once). */
let particleTexture: THREE.Texture | null = null;
function getParticleTexture(): THREE.Texture {
  if (particleTexture) return particleTexture;
  const size = 64;
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(0,255,65,1)");
  g.addColorStop(0.3, "rgba(0,255,65,0.6)");
  g.addColorStop(1, "rgba(0,255,65,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  particleTexture = new THREE.CanvasTexture(canvas);
  return particleTexture;
}

export function EdgeParticles({ simState }: { simState: React.RefObject<SimState | null> }) {
  const particlePos = useMemo(() => new Float32Array(MAX_PARTICLES * 3), []);
  const particleGeom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(particlePos, 3));
    return g;
  }, [particlePos]);

  const mat = useMemo(
    () =>
      new THREE.PointsMaterial({
        map: getParticleTexture(),
        size: 3,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [],
  );

  // Particle pool — mutable, not React state
  const poolRef = useRef<Particle[]>([]);
  const spawnTimerRef = useRef(0);
  const flashTimerRef = useRef(0);

  // Build edge endpoints list for spawnParticles (derived from sim links)
  const edgesRef = useRef<EdgeEndpoints[]>([]);

  useFrame((_, delta) => {
    const s = simState.current;
    if (!s) return;

    const ui = useUIStore.getState();
    const activeId = ui.selectedNodeId;
    const pool = poolRef.current;
    /* eslint-disable react-hooks/immutability -- Three.js buffer mutation in useFrame */
    const posAttr = particleGeom.attributes.position as THREE.BufferAttribute;
    const pos = posAttr.array as Float32Array;

    // Rebuild edge endpoints (cheap — just string coercions)
    if (edgesRef.current.length !== s.links.length) {
      edgesRef.current = s.links.map((link) => ({
        sourceId: String(typeof link.source === "object" ? link.source.id : link.source),
        targetId: String(typeof link.target === "object" ? link.target.id : link.target),
      }));
    }

    // ── Spawn new particles on active edges ──
    if (activeId) {
      spawnTimerRef.current += delta;
      if (spawnTimerRef.current > 0.12) {
        spawnTimerRef.current = 0;
        const spawned = spawnParticles(
          edgesRef.current,
          activeId,
          pool,
          MAX_PARTICLES,
          () => Math.random(),
        );
        pool.push(...spawned);
      }
    } else {
      spawnTimerRef.current = 0;
    }

    // ── Flash-triggered particles (subdued, lower frequency) ──
    flashTimerRef.current += delta;
    if (flashTimerRef.current > 0.3) {
      flashTimerRef.current = 0;
      const flashQueue = useActivityStore.getState().flashQueue;
      for (const pk of flashQueue) {
        if (pk === activeId) continue; // already handled above
        if (Math.random() > 0.3) continue; // 30% chance
        const spawned = spawnParticles(
          edgesRef.current,
          pk,
          pool,
          MAX_PARTICLES,
          () => Math.random(),
        );
        pool.push(...spawned);
      }
    }

    // ── Advance particles and write positions ──
    const alive = advanceParticles(pool, delta);

    for (let i = 0; i < alive; i++) {
      const p = pool[i];
      const link = s.links[p.linkIdx];
      if (!link) continue;
      const src = typeof link.source === "object" ? link.source : s.nodeMap.get(String(link.source));
      const tgt = typeof link.target === "object" ? link.target : s.nodeMap.get(String(link.target));
      if (!src || !tgt) continue;

      pos[i * 3] = lerp(src.x ?? 0, tgt.x ?? 0, p.t);
      pos[i * 3 + 1] = lerp(src.y ?? 0, tgt.y ?? 0, p.t);
      pos[i * 3 + 2] = lerp(src.z ?? 0, tgt.z ?? 0, p.t);
    }

    // Zero out remaining slots
    for (let i = alive; i < MAX_PARTICLES; i++) {
      pos[i * 3] = 0;
      pos[i * 3 + 1] = 0;
      pos[i * 3 + 2] = 0;
    }

    posAttr.needsUpdate = true;
    particleGeom.setDrawRange(0, alive);
    /* eslint-enable react-hooks/immutability */
  });

  return <points geometry={particleGeom} material={mat} />;
}
