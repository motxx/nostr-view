import type { NostrEvent } from "@/domain/entities/nostr-event";
import { getReferencedPubkeys } from "@/domain/entities/nostr-event";
import { type Cluster, getClusterColor } from "@/domain/entities/cluster";
import { NOSTR_KIND } from "@/lib/nostr-kinds";

/**
 * Cluster by interaction frequency using label propagation.
 * People who reply/react/repost each other end up in the same cluster.
 */
export function detectInteractionClusters(
  events: NostrEvent[],
  minClusterSize: number = 3,
  maxClusters: number = 10,
): Cluster[] {
  // 1. Build weighted interaction graph
  const interactions = new Map<string, Map<string, number>>();
  const allPubkeys = new Set<string>();

  function addEdge(a: string, b: string, weight: number) {
    allPubkeys.add(a);
    allPubkeys.add(b);
    if (!interactions.has(a)) interactions.set(a, new Map());
    if (!interactions.has(b)) interactions.set(b, new Map());
    interactions.get(a)!.set(b, (interactions.get(a)!.get(b) ?? 0) + weight);
    interactions.get(b)!.set(a, (interactions.get(b)!.get(a) ?? 0) + weight);
  }

  for (const event of events) {
    const refs = getReferencedPubkeys(event);
    if (refs.length === 0) continue;

    switch (event.kind) {
      case NOSTR_KIND.TEXT_NOTE:
        for (const ref of refs) addEdge(event.pubkey, ref, 2); // reply
        break;
      case NOSTR_KIND.REACTION:
        for (const ref of refs) addEdge(event.pubkey, ref, 1);
        break;
      case NOSTR_KIND.REPOST:
        for (const ref of refs) addEdge(event.pubkey, ref, 1.5);
        break;
      case NOSTR_KIND.CONTACT_LIST:
        for (const ref of refs) addEdge(event.pubkey, ref, 0.5);
        break;
    }
  }

  if (allPubkeys.size === 0) return [];

  // 2. Label propagation
  const labels = new Map<string, string>();
  for (const pk of allPubkeys) labels.set(pk, pk);

  for (let iter = 0; iter < 15; iter++) {
    let changed = false;
    for (const pk of allPubkeys) {
      const neighbors = interactions.get(pk);
      if (!neighbors || neighbors.size === 0) continue;

      const labelWeights = new Map<string, number>();
      for (const [neighbor, weight] of neighbors) {
        const nl = labels.get(neighbor) ?? neighbor;
        labelWeights.set(nl, (labelWeights.get(nl) ?? 0) + weight);
      }

      let bestLabel = labels.get(pk)!;
      let bestWeight = 0;
      for (const [label, weight] of labelWeights) {
        if (weight > bestWeight) {
          bestWeight = weight;
          bestLabel = label;
        }
      }
      if (bestLabel !== labels.get(pk)) {
        labels.set(pk, bestLabel);
        changed = true;
      }
    }
    if (!changed) break;
  }

  // 3. Group by label
  const groups = new Map<string, Set<string>>();
  for (const [pk, label] of labels) {
    if (!groups.has(label)) groups.set(label, new Set());
    groups.get(label)!.add(pk);
  }

  // 4. Convert to Cluster[], sorted by size
  const clusters = [...groups.entries()]
    .filter(([, members]) => members.size >= minClusterSize)
    .sort((a, b) => b[1].size - a[1].size)
    .slice(0, maxClusters)
    .map(([, members], index) => ({
      id: `interaction-${index}`,
      label: `Community ${index + 1}`,
      hashtags: [] as string[],
      memberPubkeys: members,
      color: getClusterColor(index),
    }));

  return clusters;
}
