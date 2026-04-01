import { useMemo } from "react";
import * as THREE from "three";

export function LabelSprite({
  text,
  size,
  alpha,
}: {
  text: string;
  size: number;
  alpha: number;
}) {
  const tex = useMemo(() => {
    const canvas = new OffscreenCanvas(256, 64);
    const ctx = canvas.getContext("2d")!;
    ctx.font = "24px monospace";
    ctx.fillStyle = `rgba(0,255,65,${alpha})`;
    ctx.textAlign = "center";
    ctx.fillText(text.slice(0, 20), 128, 40);
    return new THREE.CanvasTexture(canvas);
  }, [text, alpha]);

  return (
    <sprite position={[0, size + 2, 0]} scale={[size * 2.5, size * 0.6, 1]}>
      <spriteMaterial map={tex} transparent depthWrite={false} />
    </sprite>
  );
}
