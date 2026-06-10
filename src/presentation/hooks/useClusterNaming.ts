"use client";

import { useQuery } from "@tanstack/react-query";
import { useGraphStore } from "@/store/graph-store";
import { useEventStore } from "@/store/event-store";
import { useUIStore } from "@/store/ui-store";
import { NOSTR_KIND } from "@/lib/nostr-kinds";
import { clusterFingerprint } from "@/domain/entities/cluster";

/**
 * After clusters are detected, asynchronously calls the LLM to generate
 * descriptive names. Fires when unnamed clusters exist.
 *
 * - Named state lives in the Zustand store (clusterLabelOverrides)
 * - "Unnamed" clusters are derived during render from store state
 * - Override clearing on strategy change is done in the event handler
 *   (ClusterOverviewPanel onClick), not during render
 * - queryFn throws on failure so React Query retries (not return null,
 *   which would be cached as "success" with staleTime: Infinity)
 */
export function useClusterNaming() {
  const clusters = useGraphStore((s) => s.clusters);
  const overrides = useGraphStore((s) => s.clusterLabelOverrides);
  const clusterStrategy = useUIStore((s) => s.clusterStrategy);

  // Derived during render: clusters not yet named by LLM (keyed by
  // fingerprint). Locked labels (language, engagement segments) are
  // deterministic and final — never sent to the LLM.
  const unnamedIds = clusters
    .filter((c) => !c.labelLocked && !overrides.has(clusterFingerprint(c)))
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
      const toName = currentClusters.filter(
        (c) => !c.labelLocked && !currentOverrides.has(clusterFingerprint(c)),
      );
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

      if (!res.ok) {
        throw new Error(`Cluster naming API returned ${res.status}`);
      }

      const { results } = await res.json();
      if (!results || results.length === 0) {
        throw new Error("Cluster naming API returned no results");
      }

      // Build id→fingerprint mapping for the clusters we just named
      const idToFingerprint = new Map<string, string>();
      for (const c of toName) {
        idToFingerprint.set(c.id, clusterFingerprint(c));
      }

      // Cache by fingerprint so labels survive cluster ID shifts on recompute
      const labelMap = new Map<
        string,
        import("@/domain/entities/cluster").ClusterLabelOverride
      >();
      for (const r of results) {
        const fp = idToFingerprint.get(r.id);
        if (r.id && r.label && fp) {
          labelMap.set(fp, { label: r.label, tagline: r.tagline });
        }
      }

      if (labelMap.size === 0) {
        throw new Error("No valid labels in LLM response");
      }

      useGraphStore.getState().setClusterLabelOverrides(labelMap);
      return labelMap.size;
    },
    enabled: unnamedIds.length > 0,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 15000),
  });
}
