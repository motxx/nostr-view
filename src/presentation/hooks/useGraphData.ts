"use client";

import { useQuery } from "@tanstack/react-query";
import { useEventStore } from "@/store/event-store";
import { useGraphStore } from "@/store/graph-store";
import { useUIStore } from "@/store/ui-store";
import { buildGraph } from "@/domain/services/graph-builder";
import {
  detectClustersByStrategy,
  selectBestClusters,
  type ClusterStrategy,
} from "@/domain/services/cluster-strategy";
import { evaluateClusterQuality } from "@/domain/services/cluster-quality";
import { reconcileClusters } from "@/domain/services/cluster-identity";
import { computeBridges, findUserCluster } from "@/domain/services/cluster-summary";
import { computeExplorationMap } from "@/domain/services/exploration-map";
import { filterEventsByTimeRange } from "@/lib/event-histogram";

/**
 * Last computed clusters per facet — reconciliation target so cluster
 * identity survives even when auto mode switches facets and back.
 * Module-level on purpose: outlives query invalidations, single client.
 */
const lastClustersByStrategy = new Map<
  ClusterStrategy,
  import("@/domain/entities/cluster").Cluster[]
>();

/**
 * Periodically rebuilds the graph from accumulated events.
 * Reacts to cluster strategy changes and time range via queryKey.
 */
export function useGraphData() {
  const totalEvents = useEventStore((s) => s.totalEvents);
  const clusterStrategy = useUIStore((s) => s.clusterStrategy);
  const timeRange = useUIStore((s) => s.timeRange);

  useQuery({
    queryKey: ["graph-data", clusterStrategy, timeRange],
    queryFn: () => {
      const strategy = useUIStore.getState().clusterStrategy;
      const allEvents = useEventStore.getState().getAllEvents();
      const profiles = useEventStore.getState().profiles;
      const currentTimeRange = useUIStore.getState().timeRange;

      // Filter by time range if set (Feature 3)
      const events = currentTimeRange
        ? filterEventsByTimeRange(allEvents, currentTimeRange[0], currentTimeRange[1])
        : allEvents;

      // "auto" scores every facet on the same quality yardstick and
      // applies the best one for the data currently loaded
      let clusters: import("@/domain/entities/cluster").Cluster[];
      let resolvedStrategy: ClusterStrategy;
      let clusterQualities: ReturnType<typeof selectBestClusters>["qualities"];
      if (strategy === "auto") {
        // Hysteresis: keep the incumbent facet unless clearly beaten,
        // so near-tied facets don't flip the universe every refresh
        const incumbent = useGraphStore.getState().resolvedStrategy ?? undefined;
        const selection = selectBestClusters(events, 3, 10, incumbent);
        clusters = selection.clusters;
        resolvedStrategy = selection.strategy;
        clusterQualities = selection.qualities;
      } else {
        clusters = detectClustersByStrategy(events, strategy);
        resolvedStrategy = strategy;
        clusterQualities = {
          [strategy]: evaluateClusterQuality(clusters, events),
        };
      }
      // Carry cluster identity (id, color, naming fingerprint) across
      // recomputes by member overlap, so headlines and the selected
      // timeline stay stable while live data evolves. Matched against the
      // last clusters of the SAME facet — survives auto-mode facet trips.
      const previous = lastClustersByStrategy.get(resolvedStrategy);
      if (previous) {
        clusters = reconcileClusters(previous, clusters);
      }
      lastClustersByStrategy.set(resolvedStrategy, clusters);

      const { nodes, edges } = buildGraph(events, profiles, clusters);

      // Compute bridges and exploration map (Feature 2)
      const bridges = computeBridges(clusters);

      let explorationMap: import("@/domain/services/exploration-map").ExplorationMap | null = null;
      const myPubkey = useUIStore.getState().myPubkey;
      if (myPubkey) {
        const myCluster = findUserCluster(myPubkey, clusters);
        if (myCluster) {
          const clusterIds = clusters.map((c) => c.id);
          explorationMap = computeExplorationMap(
            myCluster.id,
            clusterIds,
            bridges,
          );
        }
      }

      // Single batch update — avoids intermediate re-renders
      useGraphStore.getState().setAll({
        clusters,
        nodes,
        edges,
        bridges,
        explorationMap,
        resolvedStrategy,
        clusterQualities,
      });

      return events.length;
    },
    enabled: totalEvents >= 50,
    refetchInterval: 10_000,
    staleTime: 0,
  });
}
