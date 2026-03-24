import type { NostrEvent } from "@/domain/entities/nostr-event";
import type { Cluster } from "@/domain/entities/cluster";
import { NOSTR_KIND } from "@/lib/nostr-kinds";

export interface ClusterSummary {
  clusterId: string;
  representativeNotes: NostrEvent[];
  bridgeCount: Map<string, number>; // other clusterId → shared member count
}

/**
 * Find the most engaged-with notes in a cluster.
 * "Engagement" = number of reactions + reposts targeting the note.
 */
export function findRepresentativeNotes(
  cluster: Cluster,
  events: NostrEvent[],
  limit: number = 3,
): NostrEvent[] {
  // Count engagement per note (by event id referenced in reactions/reposts)
  const engagement = new Map<string, number>();
  for (const ev of events) {
    if (ev.kind === NOSTR_KIND.REACTION || ev.kind === NOSTR_KIND.REPOST) {
      for (const tag of ev.tags) {
        if (tag[0] === "e") {
          engagement.set(tag[1], (engagement.get(tag[1]) ?? 0) + 1);
          break;
        }
      }
    }
  }

  // Get text notes from cluster members, sorted by engagement
  const clusterNotes = events
    .filter(
      (ev) =>
        ev.kind === NOSTR_KIND.TEXT_NOTE &&
        cluster.memberPubkeys.has(ev.pubkey) &&
        ev.content.length > 10,
    )
    .sort((a, b) => (engagement.get(b.id) ?? 0) - (engagement.get(a.id) ?? 0))
    .slice(0, limit);

  return clusterNotes;
}

export interface BridgeInfo {
  targetClusterId: string;
  sharedCount: number;
  /** Actual pubkeys who bridge between the two clusters */
  bridgePubkeys: string[];
}

/**
 * Compute bridges between clusters.
 * Returns bridge info including actual bridge person pubkeys.
 */
export function computeBridges(
  clusters: Cluster[],
): Map<string, BridgeInfo[]> {
  const result = new Map<string, BridgeInfo[]>();

  for (let i = 0; i < clusters.length; i++) {
    const bridges: BridgeInfo[] = [];
    for (let j = 0; j < clusters.length; j++) {
      if (i === j) continue;
      const shared: string[] = [];
      for (const pk of clusters[i].memberPubkeys) {
        if (clusters[j].memberPubkeys.has(pk)) shared.push(pk);
      }
      if (shared.length > 0) {
        bridges.push({
          targetClusterId: clusters[j].id,
          sharedCount: shared.length,
          bridgePubkeys: shared.slice(0, 5), // top 5 bridges
        });
      }
    }
    bridges.sort((a, b) => b.sharedCount - a.sharedCount);
    result.set(clusters[i].id, bridges);
  }

  return result;
}

/**
 * Find which cluster a pubkey belongs to.
 */
export function findUserCluster(
  pubkey: string,
  clusters: Cluster[],
): Cluster | null {
  for (const cluster of clusters) {
    if (cluster.memberPubkeys.has(pubkey)) return cluster;
  }
  return null;
}

/**
 * Compute total connectivity score for each cluster
 * (sum of bridges to all other clusters). Used for distance ordering.
 */
export function clusterConnectivity(
  bridges: Map<string, BridgeInfo[]>,
): Map<string, number> {
  const scores = new Map<string, number>();
  for (const [id, infos] of bridges) {
    scores.set(id, infos.reduce((sum, b) => sum + b.sharedCount, 0));
  }
  return scores;
}
