"use client";

import { useQuery } from "@tanstack/react-query";
import { useEventStore } from "@/store/event-store";
import { useGraphStore } from "@/store/graph-store";
import { buildGraph } from "@/domain/services/graph-builder";
import { detectClusters } from "@/domain/services/cluster-detector";
import { assignTiers } from "@/lib/graph-utils";
import { preloadAvatars } from "@/lib/texture-cache";

/**
 * Periodically rebuilds the graph from accumulated events.
 * TanStack Query handles the interval and enabled-gate —
 * no useEffect or setInterval needed.
 */
export function useGraphData() {
  const totalEvents = useEventStore((s) => s.totalEvents);

  useQuery({
    queryKey: ["graph-data"],
    queryFn: () => rebuildGraph(),
    enabled: totalEvents >= 50,
    refetchInterval: 10_000,
    staleTime: 10_000,
  });
}

function rebuildGraph() {
  const events = useEventStore.getState().getAllEvents();
  const profiles = useEventStore.getState().profiles;

  const clusters = detectClusters(events);
  useGraphStore.getState().setClusters(clusters);

  const { nodes, edges } = buildGraph(events, profiles, clusters);
  useGraphStore.getState().setGraphData(nodes, edges);

  // Preload avatars for Star/Planet tier nodes
  const tiers = assignTiers(nodes);
  const urls: string[] = [];
  for (const n of nodes) {
    const tier = tiers.get(n.id);
    if ((tier === "star" || tier === "planet") && n.picture) {
      urls.push(n.picture);
    }
  }
  if (urls.length > 0) preloadAvatars(urls.slice(0, 50));

  return events.length;
}
