export interface Particle {
  /** Index into the link array */
  linkIdx: number;
  /** Progress along edge, 0 → 1 */
  t: number;
  /** Fraction of edge per second (negative = reverse direction) */
  speed: number;
}

export interface EdgeEndpoints {
  sourceId: string;
  targetId: string;
}

/**
 * Spawn particles on edges connected to `activeId`.
 * `roll` is a 0–1 random value per edge (injected for testability).
 */
export function spawnParticles(
  edges: EdgeEndpoints[],
  activeId: string,
  pool: Particle[],
  maxParticles: number,
  roll: (edgeIdx: number) => number,
): Particle[] {
  const spawned: Particle[] = [];
  for (let i = 0; i < edges.length && pool.length + spawned.length < maxParticles; i++) {
    const { sourceId, targetId } = edges[i];
    if (sourceId !== activeId && targetId !== activeId) continue;
    if (roll(i) > 0.4) continue;
    const fromSource = sourceId === activeId;
    spawned.push({
      linkIdx: i,
      t: fromSource ? 0 : 1,
      speed: (0.4 + roll(i) * 0.6) * (fromSource ? 1 : -1),
    });
  }
  return spawned;
}

/**
 * Advance all particles by `delta` seconds and remove expired ones (t outside 0–1).
 * Mutates the array in-place, returns the new length.
 */
export function advanceParticles(pool: Particle[], delta: number): number {
  let alive = 0;
  for (let i = 0; i < pool.length; i++) {
    const p = pool[i];
    p.t += p.speed * delta;
    if (p.t < 0 || p.t > 1) continue;
    if (alive !== i) pool[alive] = p;
    alive++;
  }
  pool.length = alive;
  return alive;
}

/** Linearly interpolate a single component between a and b at fraction t. */
export function lerp(a: number, b: number, t: number): number {
  return a * (1 - t) + b * t;
}
