import type { BridgeInfo } from "./cluster-summary";

export interface RecommendedBridge {
  targetClusterId: string;
  viaClusters: string[];
  bridgePubkey: string;
}

export interface ExplorationMap {
  /** clusterId → hop count from user's cluster (Infinity = unreachable) */
  reachability: Map<string, number>;
  /** Fraction of clusters reachable (0–1) */
  coverage: number;
  /** Recommended bridge persons to reach unexplored clusters */
  recommendations: RecommendedBridge[];
}

/**
 * Compute exploration map from the user's cluster perspective.
 *
 * Uses BFS on the cluster adjacency graph (derived from bridges)
 * to determine reachability, coverage, and bridge recommendations.
 */
export function computeExplorationMap(
  myClusterId: string,
  clusterIds: string[],
  bridges: Map<string, BridgeInfo[]>,
): ExplorationMap {
  if (clusterIds.length === 0) {
    return { reachability: new Map(), coverage: 0, recommendations: [] };
  }

  // BFS from myClusterId on cluster adjacency graph
  const reachability = new Map<string, number>();
  for (const id of clusterIds) {
    reachability.set(id, Infinity);
  }
  reachability.set(myClusterId, 0);

  const queue: string[] = [myClusterId];
  let head = 0;
  while (head < queue.length) {
    const current = queue[head++];
    const currentDist = reachability.get(current)!;
    const neighbors = bridges.get(current) ?? [];
    for (const bridge of neighbors) {
      const neighbor = bridge.targetClusterId;
      if (!reachability.has(neighbor)) continue;
      if (reachability.get(neighbor)! <= currentDist + 1) continue;
      reachability.set(neighbor, currentDist + 1);
      queue.push(neighbor);
    }
  }

  // Coverage: reachable (finite distance) / total
  const total = clusterIds.length;
  const reachable = [...reachability.values()].filter((d) => d < Infinity).length;
  const coverage = total > 0 ? reachable / total : 0;

  // Recommendations: for each unreachable cluster, find the closest
  // reachable cluster that has a bridge to an adjacent unreachable cluster
  const recommendations: RecommendedBridge[] = [];
  const unreachableClusters = clusterIds.filter(
    (id) => reachability.get(id) === Infinity,
  );

  for (const unreachableId of unreachableClusters) {
    // Find any reachable cluster that has a bridge to this unreachable one
    let bestBridge: RecommendedBridge | null = null;
    let bestDist = Infinity;

    for (const reachableId of clusterIds) {
      const dist = reachability.get(reachableId)!;
      if (dist === Infinity) continue;
      const bridgesFromReachable = bridges.get(reachableId) ?? [];
      for (const b of bridgesFromReachable) {
        if (b.targetClusterId === unreachableId && b.bridgePubkeys.length > 0) {
          if (dist < bestDist) {
            bestDist = dist;
            bestBridge = {
              targetClusterId: unreachableId,
              viaClusters: dist > 0 ? [reachableId] : [],
              bridgePubkey: b.bridgePubkeys[0],
            };
          }
        }
      }
    }

    if (bestBridge) {
      recommendations.push(bestBridge);
    }
  }

  return { reachability, coverage, recommendations };
}
