"use client";

import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useGraphStore } from "@/store/graph-store";
import { useEventStore } from "@/store/event-store";
import { useUIStore } from "@/store/ui-store";
import { NOSTR_KIND } from "@/lib/nostr-kinds";

/**
 * After clusters are detected, asynchronously calls the LLM to generate
 * descriptive names. Only fires when new unnamed cluster IDs appear.
 *
 * State management follows Dan Abramov's principles:
 *   - Named state lives in the Zustand store (clusterLabelOverrides)
 *   - "Unnamed" clusters are derived during render from store state
 *   - No module-level mutable state, no useEffect + setState
 *   - Strategy change triggers override clear during render (not via useEffect)
 */
export function useClusterNaming() {
  const clusters = useGraphStore((s) => s.clusters);
  const overrides = useGraphStore((s) => s.clusterLabelOverrides);
  const clusterStrategy = useUIStore((s) => s.clusterStrategy);

  // Clear overrides when strategy changes (during render, not useEffect)
  const prevStrategyRef = useRef(clusterStrategy);
  if (prevStrategyRef.current !== clusterStrategy) {
    prevStrategyRef.current = clusterStrategy;
    useGraphStore.getState().clearClusterLabelOverrides();
  }

  // Derived during render: clusters that haven't been LLM-named yet
  const unnamed = clusters.filter((c) => !overrides.has(c.id));
  const unnamedKey = unnamed.map((c) => c.id).sort().join(",");

  useQuery({
    queryKey: ["cluster-names", clusterStrategy, unnamedKey],
    queryFn: async () => {
      // Re-read store at fetch time to avoid stale closures
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
    enabled: unnamed.length > 0,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: false,
  });
}
