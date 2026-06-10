"use client";

import { useMemo } from "react";
import { useGraphStore } from "@/store/graph-store";
import { useUIStore } from "@/store/ui-store";
import { applyLabelOverrides, type Cluster } from "@/domain/entities/cluster";
import {
  clusterConnectivity,
  findUserCluster,
} from "@/domain/services/cluster-summary";

/**
 * Clusters with LLM label/tagline overrides applied, sorted for display:
 * the operator's own cluster first, then by bridge connectivity.
 * Shared by the channel rail (timeline) and the channel guide
 * (ClusterOverviewPanel) so a chip's position matches its row position.
 */
export function useSortedClusters(): {
  clusters: Cluster[];
  myCluster: Cluster | null;
} {
  const rawClusters = useGraphStore((s) => s.clusters);
  const labelOverrides = useGraphStore((s) => s.clusterLabelOverrides);
  const bridges = useGraphStore((s) => s.bridges);
  const myPubkey = useUIStore((s) => s.myPubkey);

  const clusters = useMemo(
    () => applyLabelOverrides(rawClusters, labelOverrides),
    [rawClusters, labelOverrides],
  );

  const myCluster = useMemo(
    () => (myPubkey ? findUserCluster(myPubkey, clusters) : null),
    [myPubkey, clusters],
  );

  const sorted = useMemo(() => {
    const connectivity = clusterConnectivity(bridges);
    return [...clusters].sort((a, b) => {
      if (myCluster) {
        if (a.id === myCluster.id) return -1;
        if (b.id === myCluster.id) return 1;
      }
      return (connectivity.get(b.id) ?? 0) - (connectivity.get(a.id) ?? 0);
    });
  }, [clusters, myCluster, bridges]);

  return { clusters: sorted, myCluster };
}
