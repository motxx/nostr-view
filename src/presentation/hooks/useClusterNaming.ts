"use client";

import { useQuery } from "@tanstack/react-query";
import { useGraphStore } from "@/store/graph-store";
import { useEventStore } from "@/store/event-store";
import { useUIStore } from "@/store/ui-store";
import { NOSTR_KIND } from "@/lib/nostr-kinds";

// ── Module-level cache (survives component remount) ──

/** strategy → (clusterId → LLM label) */
const _namedCache = new Map<string, Map<string, string>>();

function getCache(strategy: string): Map<string, string> {
  let m = _namedCache.get(strategy);
  if (!m) {
    m = new Map();
    _namedCache.set(strategy, m);
  }
  return m;
}

/** Set of query keys currently in-flight — prevents duplicate requests */
const _inflight = new Set<string>();

/**
 * After clusters are detected, asynchronously calls the LLM to generate
 * descriptive names. Only fires when:
 *   - New cluster IDs appear that haven't been named yet
 *   - Skips if a request for the same set is already in-flight
 * Cache is keyed by strategy so switching strategies gets fresh names.
 */
export function useClusterNaming() {
  const clusters = useGraphStore((s) => s.clusters);
  const clusterStrategy = useUIStore((s) => s.clusterStrategy);

  const cache = getCache(clusterStrategy);

  // IDs that still need naming
  const unnamed = clusters.filter((c) => !cache.has(c.id));
  const unnamedKey = unnamed.map((c) => c.id).sort().join(",");

  useQuery({
    queryKey: ["cluster-names", clusterStrategy, unnamedKey],
    queryFn: async () => {
      // Guard: skip if this exact set is already being fetched
      const flightKey = `${clusterStrategy}:${unnamedKey}`;
      if (_inflight.has(flightKey)) return 0;
      _inflight.add(flightKey);

      try {
        const currentClusters = useGraphStore.getState().clusters;
        const currentStrategy = useUIStore.getState().clusterStrategy;
        const currentCache = getCache(currentStrategy);
        const toName = currentClusters.filter((c) => !currentCache.has(c.id));
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
            currentCache.set(r.id, r.label);
          }
        }

        if (labelMap.size > 0) {
          useGraphStore.getState().updateClusterLabels(labelMap);
        }

        return labelMap.size;
      } finally {
        _inflight.delete(`${clusterStrategy}:${unnamedKey}`);
      }
    },
    enabled: unnamed.length > 0 && !_inflight.has(`${clusterStrategy}:${unnamedKey}`),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: false,
  });
}
