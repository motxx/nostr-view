import type { NostrEvent } from "@/domain/entities/nostr-event";
import type { GraphNode } from "@/domain/entities/graph-node";
import type { GraphEdge, EdgeType } from "@/domain/entities/graph-edge";
import type { Cluster } from "@/domain/entities/cluster";
import type { NostrProfile } from "@/domain/entities/nostr-profile";
import { NOSTR_KIND } from "@/lib/nostr-kinds";
import {
  calculateEngagement,
  calculateClusterEngagement,
} from "./engagement";
import { extractAllInteractionEdges } from "./interaction-edges";

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/** Visual link strength for the d3-force simulation, per edge type. */
const VISUAL_EDGE_WEIGHT: Record<EdgeType, number> = {
  zap: 2.5,
  repost: 2,
  quote: 2,
  reply: 1.5,
  reaction: 1,
  mention: 1,
  follow: 1,
};

export function buildGraph(
  events: NostrEvent[],
  profiles: Map<string, NostrProfile>,
  clusters: Cluster[],
): GraphData {
  const { scores, metrics } = calculateEngagement(events);
  const clusterEngagement = calculateClusterEngagement(events, clusters);
  const pubkeySet = new Set<string>();
  const edges: GraphEdge[] = [];
  const edgeSet = new Set<string>();

  // Nodes are text-note authors — the same population the clustering
  // operates on (see buildInteractionGraph).
  for (const event of events) {
    if (event.kind === NOSTR_KIND.TEXT_NOTE) {
      pubkeySet.add(event.pubkey);
    }
  }

  // Edges from the shared NIP-aware extractor, deduplicated per
  // (type, source, target) — visualization and clustering agree on what
  // counts as an interaction.
  for (const edge of extractAllInteractionEdges(events)) {
    if (!pubkeySet.has(edge.source) || !pubkeySet.has(edge.target)) continue;
    const key = `${edge.type}:${edge.source}:${edge.target}`;
    if (edgeSet.has(key)) continue;
    edgeSet.add(key);
    edges.push({
      source: edge.source,
      target: edge.target,
      type: edge.type,
      weight: VISUAL_EDGE_WEIGHT[edge.type],
    });
  }

  // Build pubkey→cluster mapping
  const pubkeyCluster = new Map<string, string>();
  for (const cluster of clusters) {
    for (const pk of cluster.memberPubkeys) {
      pubkeyCluster.set(pk, cluster.id);
    }
  }

  // Build nodes
  const nodes: GraphNode[] = [...pubkeySet].map((pubkey) => {
    const profile = profiles.get(pubkey);
    const score = scores[pubkey] ?? 0;
    const m = metrics.get(pubkey);
    return {
      id: pubkey,
      name: profile?.displayName ?? profile?.name,
      picture: profile?.picture,
      engagementScore: score,
      clusterEngagement: clusterEngagement.get(pubkey) ?? 0,
      clusterId: pubkeyCluster.get(pubkey),
      noteCount: m?.noteCount ?? 0,
      followerCount: m?.followerCount ?? 0,
      reactionCount: m?.reactionsReceived ?? 0,
      repostCount: (m?.repostsReceived ?? 0) + (m?.quotesReceived ?? 0),
      replyCount: m?.repliesReceived ?? 0,
      zapCount: m?.zapsReceived ?? 0,
      reciprocalCount: m?.reciprocalPartners ?? 0,
    };
  });

  return { nodes, edges };
}
