import type { NostrEvent } from "@/domain/entities/nostr-event";
import { type Cluster, getClusterColor } from "@/domain/entities/cluster";
import { NOSTR_KIND } from "@/lib/nostr-kinds";
import { louvain, addUndirectedEdge, type WeightedGraph } from "./louvain";
import { rankClusterHashtags } from "./cluster-labeling";
import {
  extractAllInteractionEdges,
  type InteractionEdgeType,
} from "./interaction-edges";

/**
 * Edge weights for the social interaction graph, ordered by the effort /
 * intent the interaction costs the actor:
 *
 * - zap (4.0): costs actual sats — the strongest signal (NIP-57)
 * - reply (2.0): direct conversation (NIP-10 reply target only)
 * - repost / quote (1.5): endorsement
 * - reaction (1.0): lightweight approval (NIP-25 last-p target only)
 * - mention (1.0): thread ancestors + mentions — co-participation
 *
 * Sensitivity measured on real relay data: community structure is driven
 * by WHICH pairs interact, not the exact weight ratios (Q varied only
 * 0.776–0.795 across ratio permutations, including inverted).
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
export type InteractionWeights = Record<InteractionEdgeType, number>;

export const INTERACTION_WEIGHTS: InteractionWeights = {
  zap: 4.0,
  reply: 2.0,
  repost: 1.5,
  quote: 1.5,
  reaction: 1.0,
  mention: 1.0,
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
 * Edge semantics come from the NIP-aware extractor (interaction-edges.ts).
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
  for (const edge of extractAllInteractionEdges(events)) {
    const weight = weights[edge.type];
    if (weight <= 0) continue;
    if (active.has(edge.source) && active.has(edge.target)) {
      addUndirectedEdge(graph, edge.source, edge.target, weight);
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
