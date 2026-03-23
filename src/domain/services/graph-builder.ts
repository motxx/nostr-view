import type { NostrEvent } from "@/domain/entities/nostr-event";
import { getReferencedPubkeys } from "@/domain/entities/nostr-event";
import type { GraphNode } from "@/domain/entities/graph-node";
import type { GraphEdge } from "@/domain/entities/graph-edge";
import type { Cluster } from "@/domain/entities/cluster";
import type { NostrProfile } from "@/domain/entities/nostr-profile";
import { NOSTR_KIND } from "@/lib/nostr-kinds";
import { calculateInfluenceScores } from "./influence-calculator";

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export function buildGraph(
  events: NostrEvent[],
  profiles: Map<string, NostrProfile>,
  clusters: Cluster[],
): GraphData {
  const scores = calculateInfluenceScores(events);
  const pubkeySet = new Set<string>();
  const edges: GraphEdge[] = [];
  const edgeSet = new Set<string>();

  // Collect all pubkeys from text notes
  for (const event of events) {
    if (event.kind === NOSTR_KIND.TEXT_NOTE) {
      pubkeySet.add(event.pubkey);
    }
  }

  // Build edges
  for (const event of events) {
    const refs = getReferencedPubkeys(event);

    switch (event.kind) {
      case NOSTR_KIND.CONTACT_LIST: {
        pubkeySet.add(event.pubkey);
        for (const target of refs) {
          if (pubkeySet.has(target)) {
            const key = `follow:${event.pubkey}:${target}`;
            if (!edgeSet.has(key)) {
              edgeSet.add(key);
              edges.push({
                source: event.pubkey,
                target,
                type: "follow",
                weight: 1,
              });
            }
          }
        }
        break;
      }
      case NOSTR_KIND.REACTION: {
        for (const target of refs) {
          if (pubkeySet.has(target) && pubkeySet.has(event.pubkey)) {
            const key = `reaction:${event.pubkey}:${target}`;
            const existing = edgeSet.has(key);
            if (!existing) {
              edgeSet.add(key);
              edges.push({
                source: event.pubkey,
                target,
                type: "reaction",
                weight: 1,
              });
            }
          }
        }
        break;
      }
      case NOSTR_KIND.REPOST: {
        for (const target of refs) {
          if (pubkeySet.has(target) && pubkeySet.has(event.pubkey)) {
            const key = `repost:${event.pubkey}:${target}`;
            if (!edgeSet.has(key)) {
              edgeSet.add(key);
              edges.push({
                source: event.pubkey,
                target,
                type: "repost",
                weight: 2,
              });
            }
          }
        }
        break;
      }
      case NOSTR_KIND.TEXT_NOTE: {
        for (const target of refs) {
          if (pubkeySet.has(target)) {
            const key = `reply:${event.pubkey}:${target}`;
            if (!edgeSet.has(key)) {
              edgeSet.add(key);
              edges.push({
                source: event.pubkey,
                target,
                type: "reply",
                weight: 1.5,
              });
            }
          }
        }
        break;
      }
    }
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
    return {
      id: pubkey,
      name: profile?.displayName ?? profile?.name,
      picture: profile?.picture,
      influenceScore: score,
      clusterId: pubkeyCluster.get(pubkey),
      noteCount: 0,
      followerCount: 0,
      reactionCount: 0,
      repostCount: 0,
    };
  });

  return { nodes, edges };
}
