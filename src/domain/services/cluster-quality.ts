import type { NostrEvent } from "@/domain/entities/nostr-event";
import type { Cluster } from "@/domain/entities/cluster";
import { NOSTR_KIND } from "@/lib/nostr-kinds";
import { computeModularity } from "./louvain";
import { buildInteractionGraph } from "./interaction-cluster";

/**
 * Partition quality metrics, used to pick the best facet for the data
 * currently loaded ("auto" cluster mode).
 *
 * - modularity: Newman & Girvan (2004) modularity of the partition
 *   measured against the observed social interaction graph — the standard
 *   graph-clustering quality measure. A language or topic partition that
 *   aligns with who actually talks to whom scores high here, so all
 *   facets are compared on the same yardstick.
 * - coverage: fraction of active users (note authors) assigned to a
 *   cluster. Penalizes facets that only explain a sliver of the network.
 * - balance: Shannon entropy of cluster sizes normalized by log(k).
 *   Penalizes degenerate one-giant-cluster partitions.
 *
 * Composite score = 0.5·max(0,Q) + 0.3·coverage + 0.2·balance, scaled
 * down hard when fewer than 2 clusters exist (no partition to speak of).
 * Weights favor modularity as the only structure-aware term.
 */
export interface ClusterQuality {
  modularity: number;
  coverage: number;
  balance: number;
  numClusters: number;
  score: number;
}

export function evaluateClusterQuality(
  clusters: Cluster[],
  events: NostrEvent[],
): ClusterQuality {
  const activeUsers = new Set<string>();
  for (const e of events) {
    if (e.kind === NOSTR_KIND.TEXT_NOTE) activeUsers.add(e.pubkey);
  }

  const partition = new Map<string, string>();
  for (const cluster of clusters) {
    for (const pk of cluster.memberPubkeys) {
      partition.set(pk, cluster.id);
    }
  }

  let assignedActive = 0;
  for (const pk of activeUsers) {
    if (partition.has(pk)) assignedActive++;
  }
  const coverage = activeUsers.size > 0 ? assignedActive / activeUsers.size : 0;

  const graph = buildInteractionGraph(events);
  const modularity = graph.size > 0 ? computeModularity(graph, partition) : 0;

  const sizes = clusters.map((c) => c.memberPubkeys.size);
  const total = sizes.reduce((a, b) => a + b, 0);
  let balance = 0;
  if (clusters.length > 1 && total > 0) {
    let entropy = 0;
    for (const size of sizes) {
      if (size === 0) continue;
      const p = size / total;
      entropy -= p * Math.log(p);
    }
    balance = entropy / Math.log(clusters.length);
  }

  const numClusters = clusters.length;
  const raw =
    0.5 * Math.max(0, Math.min(1, modularity)) +
    0.3 * coverage +
    0.2 * balance;
  const score = numClusters >= 2 ? raw : raw * 0.2;

  return { modularity, coverage, balance, numClusters, score };
}
