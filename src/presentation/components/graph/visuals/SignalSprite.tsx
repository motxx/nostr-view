import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useActivityStore } from "@/store/activity-store";
import { pulsePeriod } from "@/lib/graph-math";
import { flashBoost } from "@/lib/flash-decay";

// ── Texture cache (module-level, survives re-renders) ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const signalTextureCache = new Map<string, any>();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSignalTexture(color: string): any {
  const cached = signalTextureCache.get(color);
  if (cached) return cached;
  const canvas = new OffscreenCanvas(128, 128);
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  // Sharp signal point: bright core, fast falloff
  g.addColorStop(0, color);
  g.addColorStop(0.15, color);
  g.addColorStop(0.5, color + "1a"); // ~10% alpha
  g.addColorStop(1, "transparent");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  signalTextureCache.set(color, tex);
  return tex;
}

export function SignalSprite({
  color,
  size,
  nodeId,
}: {
  color: string;
  size: number;
  nodeId?: string;
}) {
  const ref = useRef<THREE.Sprite>(null);
  const tex = useMemo(() => getSignalTexture(color), [color]);
  const baseSize = size;

  // Pulse animation via useFrame (replaces onBeforeRender hack)
  useFrame(() => {
    if (!nodeId || !ref.current) return;
    const activityState = useActivityStore.getState();

    // Flash boost: bright burst on new event arrival
    const flashTs = activityState.flashTimestamps.get(nodeId);
    const flash = flashTs ? flashBoost(Date.now() - flashTs, 1000) : 1;

    const lastPost = activityState.lastPostTime.get(nodeId);
    if (!lastPost) {
      if (flash > 1) ref.current.scale.set(baseSize * flash, baseSize * flash, 1);
      return;
    }
    const now = Date.now() / 1000;
    const period = pulsePeriod(lastPost, now);
    if (period === 0) {
      if (flash > 1) ref.current.scale.set(baseSize * flash, baseSize * flash, 1);
      return;
    }
    const s = 1 + Math.sin(((now % period) / period) * Math.PI * 2) * 0.2;
    ref.current.scale.set(baseSize * s * flash, baseSize * s * flash, 1);
  });

  return (
    <sprite ref={ref} scale={[size, size, 1]}>
      <spriteMaterial
        map={tex}
        transparent
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </sprite>
  );
}
