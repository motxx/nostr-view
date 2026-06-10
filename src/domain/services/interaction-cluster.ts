import type { NostrEvent } from "@/domain/entities/nostr-event";
import { getReferencedPubkeys } from "@/domain/entities/nostr-event";
import { type Cluster, getClusterColor } from "@/domain/entities/cluster";
import { NOSTR_KIND } from "@/lib/nostr-kinds";
import { louvain, addUndirectedEdge, type WeightedGraph } from "./louvain";
import { rankClusterHashtags } from "./cluster-labeling";

/**
 * Edge weights for the social interaction graph.
 *
 * Replies signal the strongest mutual engagement, reposts endorsement,
 * reactions lightweight approval.
 *
 * Follows are EXCLUDED (weight 0), validated on real relay data
 * (scripts/eval-clustering.ts): kind-3 contact lists are years of
 * accumulated follows, not engagement within the loaded window, and they
 * form a dense global web across communities. Any follow weight — even
 * 0.25 — collapsed 7 interpretable communities (Q=0.78) into one
 * 157-member blob (Q=0.17). Twitter's SimClusters does use follows, but
 * only after a producer-producer cosine-similarity transform at a scale
 * where that signal dominates; raw follow edges at this scale are noise.
 */
export interface InteractionWeights {
  reply: number;
  repost: number;
  reaction: number;
  follow: number;
}

export const INTERACTION_WEIGHTS: InteractionWeights = {
  reply: 2.0,
  repost: 1.5,
  reaction: 1.0,
  follow: 0,
};

/**
 * Build the undirected weighted user-user graph from Nostr events,
 * restricted to ACTIVE users (authors of text notes in the dataset).
 *
 * The restriction matters: contact lists carry hundreds of p-tags to
 * users with no activity in the loaded window. Including them floods the
 * graph with peripheral nodes and collapses community structure —
 * measured on real relay data, modularity fell from 0.71 (active-only)
 * to 0.20 (unrestricted). The visualization also only renders note
 * authors, so clustering anyone else is wasted. SimClusters applies the
 * same idea by clustering producers only.
 *
 * Shared with cluster quality evaluation (modularity is measured against
 * this graph regardless of which facet produced the partition).
 */
export function buildInteractionGraph(
  events: NostrEvent[],
  weights: InteractionWeights = INTERACTION_WEIGHTS,
): WeightedGraph {
  const active = new Set<string>();
  for (const event of events) {
    if (event.kind === NOSTR_KIND.TEXT_NOTE) active.add(event.pubkey);
  }

  const graph: WeightedGraph = new Map();
  const addActiveEdge = (a: string, b: string, weight: number) => {
    if (weight <= 0) return;
    if (active.has(a) && active.has(b)) addUndirectedEdge(graph, a, b, weight);
  };

  for (const event of events) {
    const refs = getReferencedPubkeys(event);
    if (refs.length === 0) continue;

    switch (event.kind) {
      case NOSTR_KIND.TEXT_NOTE:
        for (const ref of refs)
          addActiveEdge(event.pubkey, ref, weights.reply);
        break;
      case NOSTR_KIND.REACTION:
        for (const ref of refs)
          addActiveEdge(event.pubkey, ref, weights.reaction);
        break;
      case NOSTR_KIND.REPOST:
        for (const ref of refs)
          addActiveEdge(event.pubkey, ref, weights.repost);
        break;
      case NOSTR_KIND.CONTACT_LIST:
        for (const ref of refs)
          addActiveEdge(event.pubkey, ref, weights.follow);
        break;
    }
  }
  return graph;
}

/**
 * Community detection on the social interaction graph.
 *
 * Uses Louvain modularity optimization (Blondel et al. 2008) with a
 * connectivity post-pass — the standard for social-graph community
 * detection. Replaces label propagation, whose documented failure modes
 * (run-to-run instability, giant-community collapse; see Traag & Šubelj
 * 2023) made cluster identity churn between recomputes.
 */
export function detectInteractionClusters(
  events: NostrEvent[],
  minClusterSize: number = 3,
  maxClusters: number = 10,
): Cluster[] {
  const graph = buildInteractionGraph(events);
  if (graph.size === 0) return [];

  const { communities } = louvain(graph);

  const groups = new Map<number, Set<string>>();
  for (const [pubkey, community] of communities) {
    let members = groups.get(community);
    if (!members) {
      members = new Set();
      groups.set(community, members);
    }
    members.add(pubkey);
  }

  const kept = [...groups.values()]
    .filter((members) => members.size >= minClusterSize)
    .sort(
      (a, b) =>
        b.size - a.size ||
        [...a].sort()[0].localeCompare([...b].sort()[0]),
    )
    .slice(0, maxClusters);

  // c-TF-IDF picks tags distinctive to each community, not globally common ones
  const clusterMembers = new Map<string, Set<string>>();
  kept.forEach((members, index) =>
    clusterMembers.set(`interaction-${index}`, members),
  );
  const rankedTags = rankClusterHashtags(clusterMembers, events);

  return kept.map((members, index) => {
    const id = `interaction-${index}`;
    const topTags = rankedTags.get(id) ?? [];
    return {
      id,
      label:
        topTags.length > 0
          ? topTags.slice(0, 3).join(", ")
          : `Community ${index + 1}`,
      hashtags: topTags.slice(0, 10),
      memberPubkeys: members,
      color: getClusterColor(index),
    };
  });
}
