"use client";

import { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useGraphStore } from "@/store/graph-store";
import { useEventStore } from "@/store/event-store";
import { useUIStore } from "@/store/ui-store";
import { NOSTR_KIND } from "@/lib/nostr-kinds";

/**
 * After clusters are detected, asynchronously calls the LLM to generate
 * descriptive names. Only fires when:
 *   - The cluster strategy changes (topic → interaction, etc.)
 *   - New cluster IDs appear that haven't been named yet
 * Already-named clusters are cached and skipped.
 */
export function useClusterNaming() {
  const clusters = useGraphStore((s) => s.clusters);
  const clusterStrategy = useUIStore((s) => s.clusterStrategy);

  // Cache: cluster ID → LLM-generated label (survives re-renders, cleared on strategy change)
  const namedRef = useRef<Map<string, string>>(new Map());
  const prevStrategyRef = useRef(clusterStrategy);

  // Reset cache when strategy changes
  if (prevStrategyRef.current !== clusterStrategy) {
    prevStrategyRef.current = clusterStrategy;
    namedRef.current.clear();
  }

  // IDs that still need naming
  const unnamed = clusters.filter((c) => !namedRef.current.has(c.id));
  const unnamedKey = unnamed.map((c) => c.id).sort().join(",");

  useQuery({
    queryKey: ["cluster-names", clusterStrategy, unnamedKey],
    queryFn: async () => {
      const currentClusters = useGraphStore.getState().clusters;
      const toName = currentClusters.filter((c) => !namedRef.current.has(c.id));
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
        if (r.id && r.label) {
          labelMap.set(r.id, r.label);
          namedRef.current.set(r.id, r.label);
        }
      }

      if (labelMap.size > 0) {
        useGraphStore.getState().updateClusterLabels(labelMap);
      }

      return labelMap.size;
    },
    enabled: unnamed.length > 0,
    staleTime: Infinity, // Same key = never re-fetch (results are cached in namedRef)
    refetchOnWindowFocus: false,
  });
}
