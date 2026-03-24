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

/**
 * Compute bridge counts between clusters.
 * A "bridge" is a user who belongs to multiple clusters.
 */
export function computeBridges(
  clusters: Cluster[],
): Map<string, Map<string, number>> {
  const result = new Map<string, Map<string, number>>();

  for (let i = 0; i < clusters.length; i++) {
    const bridges = new Map<string, number>();
    for (let j = 0; j < clusters.length; j++) {
      if (i === j) continue;
      let shared = 0;
      for (const pk of clusters[i].memberPubkeys) {
        if (clusters[j].memberPubkeys.has(pk)) shared++;
      }
      if (shared > 0) {
        bridges.set(clusters[j].id, shared);
      }
    }
    result.set(clusters[i].id, bridges);
  }

  return result;
}
