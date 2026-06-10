import type { NostrEvent } from "@/domain/entities/nostr-event";
import type { Cluster } from "@/domain/entities/cluster";
import { NOSTR_KIND } from "@/lib/nostr-kinds";
import { extractAllInteractionEdges } from "./interaction-edges";
import {
  INTERACTION_WEIGHTS,
  type InteractionWeights,
} from "./interaction-cluster";

/**
 * Engagement: attention RECEIVED from other users, weighted by the intent
 * each interaction costs the sender (the same weight table the community
 * graph uses), plus an explicit reciprocity term.
 *
 *   receivedScore = Σ_type weights[type] × received[type]
 *   score         = receivedScore + RECIPROCITY_WEIGHT × reciprocalPartners
 *
 * Design properties (each verifiable from the metrics breakdown):
 * - Spam-resistant: the score counts only what OTHERS send you. Mass
 *   posting or mass mentioning earns the sender nothing (self-references
 *   are dropped at edge extraction).
 * - Influencers rank high: zaps/replies/reposts received dominate.
 * - Mutual conversation counts: each direction of a chat is "received"
 *   by one side, and every distinct reciprocal partner adds a bonus —
 *   two people talking to each other both earn engagement.
 *
 * Coefficients start from the validated interaction-weight table and are
 * checked against real relay data in scripts/eval-clustering.ts (spam→0,
 * top ranks dominated by many distinct inbound counterparts, ranking
 * stable under weight perturbation).
 */
export const RECIPROCITY_WEIGHT = 2.0;

export interface EngagementMetrics {
  noteCount: number;
  followerCount: number;
  reactionsReceived: number;
  repliesReceived: number;
  repostsReceived: number;
  quotesReceived: number;
  zapsReceived: number;
  mentionsReceived: number;
  /** distinct users who interacted with this user (any inbound type) */
  inboundPartners: number;
  /** distinct counterparts with interactions in BOTH directions */
  reciprocalPartners: number;
  /** Σ weights[type] × received[type] — recomputable from fields above */
  receivedScore: number;
  /** receivedScore + RECIPROCITY_WEIGHT × reciprocalPartners */
  score: number;
}

export interface EngagementResult {
  scores: Record<string, number>;
  metrics: Map<string, EngagementMetrics>;
}

function emptyMetrics(): EngagementMetrics {
  return {
    noteCount: 0,
    followerCount: 0,
    reactionsReceived: 0,
    repliesReceived: 0,
    repostsReceived: 0,
    quotesReceived: 0,
    zapsReceived: 0,
    mentionsReceived: 0,
    inboundPartners: 0,
    reciprocalPartners: 0,
    receivedScore: 0,
    score: 0,
  };
}

export function calculateEngagement(
  events: NostrEvent[],
  weights: InteractionWeights = INTERACTION_WEIGHTS,
): EngagementResult {
  const metrics = new Map<string, EngagementMetrics>();
  const getOrCreate = (pubkey: string): EngagementMetrics => {
    let m = metrics.get(pubkey);
    if (!m) {
      m = emptyMetrics();
      metrics.set(pubkey, m);
    }
    return m;
  };

  for (const event of events) {
    if (event.kind === NOSTR_KIND.TEXT_NOTE) getOrCreate(event.pubkey).noteCount++;
  }

  // directed interaction pairs for partner/reciprocity accounting
  const outbound = new Map<string, Set<string>>();
  const inbound = new Map<string, Set<string>>();

  for (const edge of extractAllInteractionEdges(events)) {
    if (edge.type === "follow") {
      getOrCreate(edge.target).followerCount++;
      continue;
    }
    const m = getOrCreate(edge.target);
    switch (edge.type) {
      case "reaction": m.reactionsReceived++; break;
      case "reply": m.repliesReceived++; break;
      case "repost": m.repostsReceived++; break;
      case "quote": m.quotesReceived++; break;
      case "zap": m.zapsReceived++; break;
      case "mention": m.mentionsReceived++; break;
    }
    m.receivedScore += weights[edge.type];

    let out = outbound.get(edge.source);
    if (!out) { out = new Set(); outbound.set(edge.source, out); }
    out.add(edge.target);
    let inc = inbound.get(edge.target);
    if (!inc) { inc = new Set(); inbound.set(edge.target, inc); }
    inc.add(edge.source);
  }

  for (const [pubkey, m] of metrics) {
    const inc = inbound.get(pubkey);
    if (inc) {
      m.inboundPartners = inc.size;
      const out = outbound.get(pubkey);
      if (out) {
        for (const partner of inc) {
          if (out.has(partner)) m.reciprocalPartners++;
        }
      }
    }
    m.score = m.receivedScore + RECIPROCITY_WEIGHT * m.reciprocalPartners;
  }

  const scores: Record<string, number> = {};
  for (const [pubkey, m] of metrics) scores[pubkey] = m.score;
  return { scores, metrics };
}

/**
 * Engagement received from members of the user's OWN cluster — the
 * cluster-contextual variant used for centripetal layout: whoever this
 * community engages with most sits at the nebula's core.
 */
export function calculateClusterEngagement(
  events: NostrEvent[],
  clusters: Cluster[],
  weights: InteractionWeights = INTERACTION_WEIGHTS,
): Map<string, number> {
  const clusterOf = new Map<string, string>();
  for (const cluster of clusters) {
    for (const pk of cluster.memberPubkeys) clusterOf.set(pk, cluster.id);
  }

  const result = new Map<string, number>();
  for (const edge of extractAllInteractionEdges(events)) {
    if (edge.type === "follow") continue;
    const targetCluster = clusterOf.get(edge.target);
    if (targetCluster === undefined) continue;
    if (clusterOf.get(edge.source) !== targetCluster) continue;
    result.set(
      edge.target,
      (result.get(edge.target) ?? 0) + weights[edge.type],
    );
  }
  return result;
}
