"use client";

import { useMemo, useState } from "react";
import { useClusterTimeline } from "@/presentation/hooks/useClusterDetection";
import { useActivityStore } from "@/store/activity-store";
import { filterByHashtag } from "@/domain/entities/nostr-event";
import { NoteCard } from "./NoteCard";
import { Badge } from "@/components/ui/badge";
import { useNowSec } from "@/lib/use-now-sec";

interface ClusterTimelineProps {
  clusterId: string | null;
}

export function ClusterTimeline({ clusterId }: ClusterTimelineProps) {
  const { events, cluster, profiles } = useClusterTimeline(clusterId);
  const lastPostTime = useActivityStore((s) => s.lastPostTime);
  const nowSec = useNowSec();
  const [filterTag, setFilterTag] = useState<string | null>(null);

  const activeCount = useMemo(() => {
    if (!cluster) return 0;
    const twoHoursAgo = nowSec - 7200;
    let count = 0;
    for (const pk of cluster.memberPubkeys) {
      const last = lastPostTime.get(pk);
      if (last && last > twoHoursAgo) count++;
    }
    return count;
  }, [cluster, lastPostTime, nowSec]);

  const filteredEvents = useMemo(
    () => filterByHashtag(events, filterTag),
    [events, filterTag],
  );

  const handleTagClick = (tag: string) => {
    setFilterTag((prev) => (prev === tag ? null : tag));
  };

  if (!cluster) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="font-mono text-[10px] text-[#00ff41]/25 uppercase tracking-wider">
          Select target cluster
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-[#00ff41]/10">
        <h2
          className="font-mono text-sm font-bold uppercase tracking-wider"
          style={{ color: cluster.color }}
        >
          {cluster.label}
        </h2>
        <div className="flex flex-wrap gap-1 mt-2">
          {cluster.hashtags.slice(0, 5).map((tag) => {
            const isActive = filterTag === tag;
            return (
              <button key={tag} onClick={() => handleTagClick(tag)}>
                <Badge
                  variant="secondary"
                  className={`font-mono text-[10px] cursor-pointer transition-colors ${
                    isActive
                      ? "bg-[#00ff41]/20 text-[#00ff41] border-[#00ff41]/40"
                      : "bg-[#00ff41]/5 border-[#00ff41]/15 text-[#00ff41]/50 hover:bg-[#00ff41]/10 hover:text-[#00ff41]/70"
                  }`}
                  style={{ borderColor: isActive ? undefined : cluster.color + "40" }}
                >
                  #{tag}
                </Badge>
              </button>
            );
          })}
        </div>
        <div className="flex gap-3 font-mono text-[10px] text-[#0ff]/30 mt-2 uppercase">
          <span>{cluster.memberPubkeys.size} subjects</span>
          <span
            className={activeCount > 0 ? "text-[#00ff41]/60" : "text-white/20"}
          >
            {activeCount} active
          </span>
          <span>
            {filterTag
              ? `${filteredEvents.length}/${events.length} signals`
              : `${events.length} signals`}
          </span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto osint-scroll px-3 py-2 space-y-2">
        {filteredEvents.map((event) => (
          <NoteCard
            key={event.id}
            event={event}
            profile={profiles?.get(event.pubkey)}
          />
        ))}
        {filteredEvents.length === 0 && (
          <p className="font-mono text-[10px] text-[#00ff41]/20 text-center py-8 uppercase tracking-wider">
            {filterTag ? "No signals match filter" : "No signals intercepted"}
          </p>
        )}
      </div>
    </div>
  );
}
