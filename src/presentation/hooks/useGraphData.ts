"use client";

import { useQuery } from "@tanstack/react-query";
import { useEventStore } from "@/store/event-store";
import { useGraphStore } from "@/store/graph-store";
import { useUIStore } from "@/store/ui-store";
import { buildGraph } from "@/domain/services/graph-builder";
import { detectClustersByStrategy } from "@/domain/services/cluster-strategy";
import { computeBridges, findUserCluster } from "@/domain/services/cluster-summary";
import { computeExplorationMap } from "@/domain/services/exploration-map";
import { filterEventsByTimeRange } from "@/lib/event-histogram";

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

      const clusters = detectClustersByStrategy(events, strategy);
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
      });

      return events.length;
    },
    enabled: totalEvents >= 50,
    refetchInterval: 10_000,
    staleTime: 10_000,
  });
}
