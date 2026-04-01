"use client";

import { useQuery } from "@tanstack/react-query";
import { useGraphStore } from "@/store/graph-store";
import { useEventStore } from "@/store/event-store";
import { NOSTR_KIND } from "@/lib/nostr-kinds";

/**
 * After clusters are detected, asynchronously calls the LLM to generate
 * descriptive names. Updates cluster labels in the store when results arrive.
 */
export function useClusterNaming() {
  const clusters = useGraphStore((s) => s.clusters);
  const eventsById = useEventStore((s) => s.eventsById);

  // Build a stable key from cluster IDs so we only re-fetch when clusters change
  const clusterKey = clusters.map((c) => c.id).sort().join(",");

  useQuery({
    queryKey: ["cluster-names", clusterKey],
    queryFn: async () => {
      const currentClusters = useGraphStore.getState().clusters;
      const allEvents = [...useEventStore.getState().eventsById.values()];

      // Build sample content per cluster
      const clusterInputs = currentClusters.map((c) => {
        const memberNotes = allEvents.filter(
          (e) =>
            e.kind === NOSTR_KIND.TEXT_NOTE && c.memberPubkeys.has(e.pubkey),
        );
        // Pick up to 5 recent notes as samples
        const sampleContent = memberNotes
          .sort((a, b) => b.created_at - a.created_at)
          .slice(0, 5)
          .map((e) => e.content);

        return {
          id: c.id,
          currentLabel: c.label,
          hashtags: c.hashtags,
          memberCount: c.memberPubkeys.size,
          sampleContent,
        };
      });

      const res = await fetch("/api/cluster-names", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clusters: clusterInputs }),
      });

      if (!res.ok) return null;

      const { results } = await res.json();
      if (!results || results.length === 0) return null;

      const labelMap = new Map<string, string>();
      for (const r of results) {
        if (r.id && r.label) labelMap.set(r.id, r.label);
      }

      if (labelMap.size > 0) {
        useGraphStore.getState().updateClusterLabels(labelMap);
      }

      return labelMap.size;
    },
    enabled: clusters.length > 0,
    staleTime: 60_000, // Don't re-fetch for 1 minute
    refetchOnWindowFocus: false,
  });
}
