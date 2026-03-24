"use client";

import { useQuery } from "@tanstack/react-query";
import { useEventStore } from "@/store/event-store";
import { useGraphStore } from "@/store/graph-store";
import { useUIStore } from "@/store/ui-store";
import { buildGraph } from "@/domain/services/graph-builder";
import { detectClustersByStrategy } from "@/domain/services/cluster-strategy";

/**
 * Periodically rebuilds the graph from accumulated events.
 * Reacts to cluster strategy changes via queryKey.
 */
export function useGraphData() {
  const totalEvents = useEventStore((s) => s.totalEvents);
  const clusterStrategy = useUIStore((s) => s.clusterStrategy);

  useQuery({
    queryKey: ["graph-data", clusterStrategy],
    queryFn: () => {
      const strategy = useUIStore.getState().clusterStrategy;
      const events = useEventStore.getState().getAllEvents();
      const profiles = useEventStore.getState().profiles;

      const clusters = detectClustersByStrategy(events, strategy);
      useGraphStore.getState().setClusters(clusters);

      const { nodes, edges } = buildGraph(events, profiles, clusters);
      useGraphStore.getState().setGraphData(nodes, edges);

      return events.length;
    },
    enabled: totalEvents >= 50,
    refetchInterval: 10_000,
    staleTime: 10_000,
  });
}
