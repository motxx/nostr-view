"use client";

import { useQuery } from "@tanstack/react-query";
import { useGraphStore } from "@/store/graph-store";
import { useEventStore } from "@/store/event-store";
import { useUIStore } from "@/store/ui-store";
import { NOSTR_KIND } from "@/lib/nostr-kinds";

/**
 * After clusters are detected, asynchronously calls the LLM to generate
 * descriptive names. Fires when unnamed clusters exist.
 *
 * - Named state lives in the Zustand store (clusterLabelOverrides)
 * - "Unnamed" clusters are derived during render from store state
 * - Override clearing on strategy change is done in the event handler
 *   (ClusterOverviewPanel onClick), not during render
 * - queryFn re-checks overrides before calling API to avoid redundant requests
 *   when a prior in-flight request already named some clusters
 */
export function useClusterNaming() {
  const clusters = useGraphStore((s) => s.clusters);
  const overrides = useGraphStore((s) => s.clusterLabelOverrides);
  const clusterStrategy = useUIStore((s) => s.clusterStrategy);

  // Derived during render: clusters not yet named by LLM
  const unnamedIds = clusters
    .filter((c) => !overrides.has(c.id))
    .map((c) => c.id)
    .sort()
    .join(",");

  useQuery({
    queryKey: ["cluster-names", clusterStrategy, unnamedIds],
    queryFn: async () => {
      // Re-read store at fetch time — a prior in-flight request may have
      // already named some of these clusters
      const currentClusters = useGraphStore.getState().clusters;
      const currentOverrides = useGraphStore.getState().clusterLabelOverrides;
      const toName = currentClusters.filter((c) => !currentOverrides.has(c.id));
      if (toName.length === 0) return 0;

      const allEvents = [...useEventStore.getState().eventsById.values()];

      const clusterInputs = toName.map((c) => {
        const memberNotes = allEvents.filter(
          (e) =>
            e.kind === NOSTR_KIND.TEXT_NOTE && c.memberPubkeys.has(e.pubkey),
        );
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
        useGraphStore.getState().setClusterLabelOverrides(labelMap);
      }

      return labelMap.size;
    },
    enabled: unnamedIds.length > 0,
    staleTime: Infinity, // Same unnamed set = never re-fetch
    refetchOnWindowFocus: false,
    retry: false,
  });
}
