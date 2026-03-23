import * as THREE from "three";
import { getCachedTexture } from "./texture-cache";

/* ── Tier types ── */
export type NodeTier = "star" | "planet" | "dust";

export interface TieredNode {
  id: string;
  tier: NodeTier;
  influenceScore: number;
}

/**
 * Assign tier based on influence rank.
 * Star: top 10, Planet: next 40, Dust: rest
 */
export function assignTiers(
  nodes: { id: string; influenceScore: number }[],
): Map<string, NodeTier> {
  const sorted = [...nodes].sort(
    (a, b) => b.influenceScore - a.influenceScore,
  );
  const map = new Map<string, NodeTier>();
  sorted.forEach((n, i) => {
    if (i < 10) map.set(n.id, "star");
    else if (i < 50) map.set(n.id, "planet");
    else map.set(n.id, "dust");
  });
  return map;
}

/* ── Glow sprite helper ── */

export function createGlowSprite(color: string, size: number): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;

  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, color);
  gradient.addColorStop(0.2, color);
  gradient.addColorStop(0.4, adjustAlpha(color, 0.6));
  gradient.addColorStop(0.7, adjustAlpha(color, 0.15));
  gradient.addColorStop(1, "transparent");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(size, size, 1);
  return sprite;
}

function adjustAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/* ── Label helper ── */

function createLabelSprite(
  text: string,
  size: number,
  alpha: number,
): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  ctx.font = "24px monospace";
  ctx.fillStyle = `rgba(255,255,255,${alpha})`;
  ctx.textAlign = "center";
  ctx.fillText(text.slice(0, 20), 128, 40);

  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.position.set(0, size + 3, 0);
  sprite.scale.set(size * 4, size, 1);
  return sprite;
}

/* ── Avatar sphere helper ── */

function createAvatarSphere(
  radius: number,
  color: THREE.Color,
  pictureUrl?: string,
): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(radius, 32, 32);
  const tex = pictureUrl ? getCachedTexture(pictureUrl) : undefined;

  const material = tex
    ? new THREE.MeshBasicMaterial({ map: tex })
    : new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.9,
      });

  return new THREE.Mesh(geometry, material);
}

/* ── Orbit ring (Star only) ── */

function createOrbitRing(radius: number, color: THREE.Color): THREE.Line {
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= 64; i++) {
    const angle = (i / 64) * Math.PI * 2;
    points.push(
      new THREE.Vector3(
        Math.cos(angle) * radius,
        0,
        Math.sin(angle) * radius,
      ),
    );
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.3,
    blending: THREE.AdditiveBlending,
  });
  return new THREE.Line(geometry, material);
}

/* ── Tier-specific node factories ── */

export function createStarNode(
  score: number,
  color: string,
  name?: string,
  pictureUrl?: string,
): THREE.Group {
  const size = influenceToSize(score);
  const threeColor = new THREE.Color(color);
  const group = new THREE.Group();

  // Avatar sphere
  const sphere = createAvatarSphere(size * 0.5, threeColor, pictureUrl);
  group.add(sphere);

  // Orbit ring
  const ring = createOrbitRing(size * 1.2, threeColor);
  group.add(ring);

  // Large glow
  const glow = createGlowSprite(color, size * 3.5);
  glow.name = "glow";
  group.add(glow);

  // Always-on label
  if (name) {
    group.add(createLabelSprite(name, size, 0.8));
  }

  return group;
}

export function createPlanetNode(
  score: number,
  color: string,
  name?: string,
  pictureUrl?: string,
): THREE.Group {
  const size = influenceToSize(score);
  const threeColor = new THREE.Color(color);
  const group = new THREE.Group();

  // Avatar sphere
  const sphere = createAvatarSphere(size * 0.4, threeColor, pictureUrl);
  group.add(sphere);

  // Glow
  const glow = createGlowSprite(color, size * 2.5);
  glow.name = "glow";
  group.add(glow);

  // Label
  if (name) {
    group.add(createLabelSprite(name, size, 0.6));
  }

  return group;
}

export function createDustNode(score: number, color: string): THREE.Group {
  const size = Math.max(2, influenceToSize(score) * 0.6);
  const group = new THREE.Group();

  const glow = createGlowSprite(color, size * 1.5);
  glow.name = "glow";
  group.add(glow);

  return group;
}

/* ── Starfield background ── */

export function createStarField(count: number, spread: number): THREE.Points {
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * spread;
    positions[i * 3 + 1] = (Math.random() - 0.5) * spread;
    positions[i * 3 + 2] = (Math.random() - 0.5) * spread;
    sizes[i] = Math.random() * 1.5 + 0.5;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

  const material = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.5,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });

  return new THREE.Points(geometry, material);
}

/* ── Score helpers ── */

export function influenceToSize(score: number): number {
  return Math.max(2, Math.min(20, 2 + Math.log1p(score) * 3));
}

export function influenceToColor(score: number, baseColor?: string): string {
  if (baseColor) return baseColor;
  const intensity = Math.min(1, score / 100);
  const r = Math.round(100 + intensity * 155);
  const g = Math.round(150 + intensity * 105);
  const b = Math.round(255);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/* ── Pulse helpers ── */

/**
 * Returns pulse period in seconds based on how recently a node posted.
 * Recent = fast pulse (1s), old = slow (5s), >2h = 0 (static).
 */
export function pulsePeriod(lastPostTimeSec: number, nowSec: number): number {
  const elapsed = nowSec - lastPostTimeSec;
  if (elapsed > 7200) return 0; // >2h → static
  // Lerp: 0s→1s period, 7200s→5s period
  return 1 + (elapsed / 7200) * 4;
}
