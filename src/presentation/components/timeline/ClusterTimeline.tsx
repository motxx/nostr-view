"use client";

import { useMemo } from "react";
import { useClusterTimeline } from "@/presentation/hooks/useClusterDetection";
import { useActivityStore } from "@/store/activity-store";
import { NoteCard } from "./NoteCard";
import { Badge } from "@/components/ui/badge";

interface ClusterTimelineProps {
  clusterId: string | null;
}

export function ClusterTimeline({ clusterId }: ClusterTimelineProps) {
  const { events, cluster, profiles } = useClusterTimeline(clusterId);
  const lastPostTime = useActivityStore((s) => s.lastPostTime);

  // Count recently active members (posted within 2h)
  const activeCount = useMemo(() => {
    if (!cluster) return 0;
    const twoHoursAgo = Math.floor(Date.now() / 1000) - 7200;
    let count = 0;
    for (const pk of cluster.memberPubkeys) {
      const last = lastPostTime.get(pk);
      if (last && last > twoHoursAgo) count++;
    }
    return count;
  }, [cluster, lastPostTime]);

  if (!cluster) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="font-mono text-sm text-white/30">
          Select a cluster to view timeline
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-white/10">
        <h2
          className="font-mono text-sm font-bold"
          style={{ color: cluster.color }}
        >
          {cluster.label}
        </h2>
        <div className="flex flex-wrap gap-1 mt-2">
          {cluster.hashtags.slice(0, 5).map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="font-mono text-xs"
              style={{ borderColor: cluster.color }}
            >
              #{tag}
            </Badge>
          ))}
        </div>
        <div className="flex gap-3 font-mono text-xs text-white/40 mt-2">
          <span>{cluster.memberPubkeys.size} members</span>
          <span
            className={activeCount > 0 ? "text-green-400/70" : "text-white/30"}
          >
            {activeCount} active now
          </span>
          <span>{events.length} notes</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {events.map((event) => (
          <NoteCard
            key={event.id}
            event={event}
            profile={profiles?.get(event.pubkey)}
          />
        ))}
        {events.length === 0 && (
          <p className="font-mono text-sm text-white/30 text-center py-8">
            No notes yet
          </p>
        )}
      </div>
    </div>
  );
}
