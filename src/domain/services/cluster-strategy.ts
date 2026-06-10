import type { NostrEvent } from "@/domain/entities/nostr-event";
import type { Cluster } from "@/domain/entities/cluster";
import { detectClusters } from "./cluster-detector";
import { detectInteractionClusters } from "./interaction-cluster";
import { detectLanguageClusters } from "./language-cluster";
import { detectEngagementClusters } from "./engagement-cluster";
import {
  evaluateClusterQuality,
  type ClusterQuality,
} from "./cluster-quality";

export type ClusterStrategy =
  | "topic"
  | "interaction"
  | "language"
  | "engagement";

/** A strategy, or "auto" = pick the highest-quality facet for the data. */
export type ClusterMode = ClusterStrategy | "auto";

/** Order doubles as the deterministic tie-break priority for auto mode. */
export const CLUSTER_STRATEGIES: ClusterStrategy[] = [
  "interaction",
  "topic",
  "language",
  "engagement",
];

export const CLUSTER_MODES: ClusterMode[] = ["auto", ...CLUSTER_STRATEGIES];

export const CLUSTER_STRATEGY_LABELS: Record<ClusterStrategy, string> = {
  topic: "Topic",
  interaction: "Community",
  language: "Language",
  engagement: "Engagement",
};

export const CLUSTER_MODE_LABELS: Record<ClusterMode, string> = {
  auto: "Auto",
  ...CLUSTER_STRATEGY_LABELS,
};

export function detectClustersByStrategy(
  events: NostrEvent[],
  strategy: ClusterStrategy,
  minClusterSize: number = 3,
  maxClusters: number = 10,
): Cluster[] {
  switch (strategy) {
    case "topic":
      return detectClusters(events, minClusterSize, maxClusters);
    case "interaction":
      return detectInteractionClusters(events, minClusterSize, maxClusters);
    case "language":
      return detectLanguageClusters(events, minClusterSize, maxClusters);
    case "engagement":
      return detectEngagementClusters(events, minClusterSize, maxClusters);
  }
}

export interface StrategySelection {
  /** The facet that won (or the one explicitly requested) */
  strategy: ClusterStrategy;
  clusters: Cluster[];
  /** Quality of every evaluated facet, for display/inspection */
  qualities: Partial<Record<ClusterStrategy, ClusterQuality>>;
}

/**
 * Auto mode: run every facet, score each partition with the same quality
 * yardstick (modularity vs the interaction graph + coverage + balance),
 * and return the best one. Deterministic: ties resolve in
 * CLUSTER_STRATEGIES order.
 */
export function selectBestClusters(
  events: NostrEvent[],
  minClusterSize: number = 3,
  maxClusters: number = 10,
): StrategySelection {
  const qualities: Partial<Record<ClusterStrategy, ClusterQuality>> = {};
  let best: { strategy: ClusterStrategy; clusters: Cluster[]; score: number } | null =
    null;

  for (const strategy of CLUSTER_STRATEGIES) {
    const clusters = detectClustersByStrategy(
      events,
      strategy,
      minClusterSize,
      maxClusters,
    );
    const quality = evaluateClusterQuality(clusters, events);
    qualities[strategy] = quality;
    if (best === null || quality.score > best.score) {
      best = { strategy, clusters, score: quality.score };
    }
  }

  return {
    strategy: best!.strategy,
    clusters: best!.clusters,
    qualities,
  };
}
