import type { NostrEvent } from "@/domain/entities/nostr-event";
import type { Cluster } from "@/domain/entities/cluster";
import { detectClusters } from "./cluster-detector";
import { detectInteractionClusters } from "./interaction-cluster";
import { detectLanguageClusters } from "./language-cluster";

export type ClusterStrategy = "topic" | "interaction" | "language";

export const CLUSTER_STRATEGY_LABELS: Record<ClusterStrategy, string> = {
  topic: "Topic",
  interaction: "Community",
  language: "Language",
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
  }
}
