"use client";

import { useMemo } from "react";
import { useGraphStore, selectLabeledClusters } from "@/store/graph-store";
import { useEventStore } from "@/store/event-store";
import type { NostrEvent } from "@/domain/entities/nostr-event";
import { NOSTR_KIND } from "@/lib/nostr-kinds";

export function useClusterTimeline(clusterId: string | null) {
  const clusters = useGraphStore(selectLabeledClusters);
  const getEventsByKind = useEventStore((s) => s.getEventsByKind);
  const profiles = useEventStore((s) => s.profiles);

  return useMemo(() => {
    if (!clusterId) return { events: [], cluster: null };

    const cluster = clusters.find((c) => c.id === clusterId);
    if (!cluster) return { events: [], cluster: null };

    const textNotes = getEventsByKind(NOSTR_KIND.TEXT_NOTE);
    const clusterEvents = textNotes
      .filter((e: NostrEvent) => cluster.memberPubkeys.has(e.pubkey))
      .sort((a: NostrEvent, b: NostrEvent) => b.created_at - a.created_at)
      .slice(0, 50);

    return { events: clusterEvents, cluster, profiles };
  }, [clusterId, clusters, getEventsByKind, profiles]);
}
