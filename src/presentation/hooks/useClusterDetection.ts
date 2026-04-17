"use client";

import { useMemo } from "react";
import { useGraphStore } from "@/store/graph-store";
import { useEventStore } from "@/store/event-store";
import type { NostrEvent } from "@/domain/entities/nostr-event";
import { NOSTR_KIND } from "@/lib/nostr-kinds";
import { clusterFingerprint } from "@/domain/entities/cluster";

export function useClusterTimeline(clusterId: string | null) {
  const rawClusters = useGraphStore((s) => s.clusters);
  const labelOverrides = useGraphStore((s) => s.clusterLabelOverrides);
  const getEventsByKind = useEventStore((s) => s.getEventsByKind);
  const profiles = useEventStore((s) => s.profiles);

  const clusters = useMemo(() => {
    if (labelOverrides.size === 0) return rawClusters;
    return rawClusters.map((c) => {
      const override = labelOverrides.get(clusterFingerprint(c));
      return override ? { ...c, label: override } : c;
    });
  }, [rawClusters, labelOverrides]);

  return useMemo(() => {
    if (!clusterId) return { events: [], cluster: null };

    const cluster = clusters.find((c) => c.id === clusterId);
    if (!cluster) return { events: [], cluster: null };

    const textNotes = getEventsByKind(NOSTR_KIND.TEXT_NOTE);
    const clusterEvents = textNotes
      .filter((e: NostrEvent) => cluster.memberPubkeys.has(e.pubkey))
      .sort((a: NostrEvent, b: NostrEvent) => b.created_at - a.created_at);

    return { events: clusterEvents, cluster, profiles };
  }, [clusterId, clusters, getEventsByKind, profiles]);
}
