/**
 * c-TF-IDF: class-based TF-IDF for cluster labeling.
 *
 * Reference: Grootendorst (2022), "BERTopic: Neural topic modeling with a
 * class-based TF-IDF procedure", arXiv:2203.05794.
 *
 *   W(t, c) = tf(t, c) × log(1 + A / tf(t))
 *
 * where tf(t, c) = frequency of term t in cluster c, tf(t) = total
 * frequency of t across all clusters, A = average term count per cluster.
 *
 * Raw frequency surfaces globally common tags (#nostr, #gm) in every
 * cluster; the log(1 + A/tf(t)) inverse-class-frequency factor downweights
 * them and upweights tags distinctive to one cluster.
 */

import type { NostrEvent } from "@/domain/entities/nostr-event";
import { getHashtags } from "@/domain/entities/nostr-event";
import { NOSTR_KIND } from "@/lib/nostr-kinds";

/**
 * Rank terms per cluster by c-TF-IDF weight (descending).
 *
 * @param clusterTermCounts clusterId → (term → raw count within cluster)
 */
export function rankTermsByCTfIdf(
  clusterTermCounts: Map<string, Map<string, number>>,
): Map<string, string[]> {
  // tf(t) across all clusters and A = average term mass per cluster
  const globalTermFreq = new Map<string, number>();
  let totalMass = 0;
  for (const counts of clusterTermCounts.values()) {
    for (const [term, count] of counts) {
      globalTermFreq.set(term, (globalTermFreq.get(term) ?? 0) + count);
      totalMass += count;
    }
  }
  const numClusters = clusterTermCounts.size;
  if (numClusters === 0 || totalMass === 0) {
    return new Map([...clusterTermCounts.keys()].map((id) => [id, []]));
  }
  const avgMassPerCluster = totalMass / numClusters;

  const ranked = new Map<string, string[]>();
  for (const [clusterId, counts] of clusterTermCounts) {
    const scored = [...counts.entries()].map(([term, tf]) => {
      const globalTf = globalTermFreq.get(term) ?? tf;
      const weight = tf * Math.log(1 + avgMassPerCluster / globalTf);
      return { term, weight };
    });
    scored.sort(
      (a, b) => b.weight - a.weight || a.term.localeCompare(b.term),
    );
    ranked.set(
      clusterId,
      scored.map((s) => s.term),
    );
  }
  return ranked;
}

/** pubkey → (hashtag → count) accumulated from text notes. */
export function buildMemberHashtagCounts(
  events: NostrEvent[],
): Map<string, Map<string, number>> {
  const memberHashtags = new Map<string, Map<string, number>>();
  for (const event of events) {
    if (event.kind !== NOSTR_KIND.TEXT_NOTE) continue;
    for (const tag of getHashtags(event)) {
      let m = memberHashtags.get(event.pubkey);
      if (!m) {
        m = new Map();
        memberHashtags.set(event.pubkey, m);
      }
      m.set(tag, (m.get(tag) ?? 0) + 1);
    }
  }
  return memberHashtags;
}

/**
 * Compute c-TF-IDF-ranked hashtags for each cluster of users.
 *
 * @param clusterMembers clusterId → member pubkeys
 * @returns clusterId → hashtags sorted by distinctiveness
 */
export function rankClusterHashtags(
  clusterMembers: Map<string, Set<string>>,
  events: NostrEvent[],
): Map<string, string[]> {
  const memberHashtags = buildMemberHashtagCounts(events);

  const clusterTermCounts = new Map<string, Map<string, number>>();
  for (const [clusterId, members] of clusterMembers) {
    const counts = new Map<string, number>();
    for (const pk of members) {
      const tags = memberHashtags.get(pk);
      if (!tags) continue;
      for (const [tag, count] of tags) {
        counts.set(tag, (counts.get(tag) ?? 0) + count);
      }
    }
    clusterTermCounts.set(clusterId, counts);
  }
  return rankTermsByCTfIdf(clusterTermCounts);
}
