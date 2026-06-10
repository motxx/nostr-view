import type { Cluster } from "@/domain/entities/cluster";
import { clusterFingerprint } from "@/domain/entities/cluster";

/**
 * Carry cluster identity across recomputes.
 *
 * Clusters are recomputed every ~10s from live data. Positional ids
 * (interaction-0, cluster-3) and hashtag-based fingerprints both drift as
 * events accumulate, which made LLM-generated headlines churn ("Reserve
 * Wars" → renamed 10s later) and could silently swap the timeline under
 * the reader. A community's stable identity is its PEOPLE: match each new
 * cluster to the previous cluster with the highest member-overlap
 * (Jaccard ≥ minJaccard, greedy one-to-one) and let it inherit the
 * previous id, color, and naming fingerprint.
 */
export function reconcileClusters(
  previous: Cluster[],
  next: Cluster[],
  minJaccard: number = 0.3,
): Cluster[] {
  if (previous.length === 0 || next.length === 0) return next;

  const pairs: { pi: number; ni: number; j: number }[] = [];
  previous.forEach((p, pi) => {
    next.forEach((n, ni) => {
      const j = jaccard(p.memberPubkeys, n.memberPubkeys);
      if (j >= minJaccard) pairs.push({ pi, ni, j });
    });
  });
  // Best matches first; deterministic tie-break
  pairs.sort((a, b) => b.j - a.j || a.ni - b.ni || a.pi - b.pi);

  const usedPrev = new Set<number>();
  const matchedNext = new Map<number, number>();
  for (const { pi, ni } of pairs) {
    if (usedPrev.has(pi) || matchedNext.has(ni)) continue;
    usedPrev.add(pi);
    matchedNext.set(ni, pi);
  }

  const takenIds = new Set(
    [...matchedNext.values()].map((pi) => previous[pi].id),
  );

  return next.map((n, ni) => {
    const pi = matchedNext.get(ni);
    if (pi !== undefined) {
      const p = previous[pi];
      return {
        ...n,
        id: p.id,
        color: p.color,
        // inherit the naming-cache key so the LLM headline sticks
        fingerprint: clusterFingerprint(p),
      };
    }
    // Genuinely new community. Its natural id may collide with an id
    // another cluster just inherited — suffix until unique.
    let id = n.id;
    while (takenIds.has(id)) id = `${id}~`;
    takenIds.add(id);
    return id === n.id ? n : { ...n, id };
  });
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const x of small) {
    if (large.has(x)) intersection++;
  }
  return intersection / (a.size + b.size - intersection);
}
