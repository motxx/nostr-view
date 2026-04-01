/**
 * Compute a multiplicative glow boost for a node that just received an event.
 * Returns ~2x at t=0, decays exponentially to 1.0 at ttl.
 *
 * Pure function — no side effects.
 */
export function flashBoost(elapsedMs: number, ttlMs: number): number {
  if (elapsedMs < 0) return 1;
  if (elapsedMs >= ttlMs) return 1;
  return 1 + Math.exp((-elapsedMs / ttlMs) * 5);
}
