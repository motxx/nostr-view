"use client";

import { useMemo } from "react";
import { useGraphStore } from "@/store/graph-store";
import { useUIStore } from "@/store/ui-store";
import { useActivityStore } from "@/store/activity-store";
import { useEventStore } from "@/store/event-store";
import { Badge } from "@/components/ui/badge";
import { NOSTR_KIND } from "@/lib/nostr-kinds";

export function GraphControls() {
  const clusters = useGraphStore((s) => s.clusters);
  const selectedClusterId = useUIStore((s) => s.selectedClusterId);
  const selectCluster = useUIStore((s) => s.selectCluster);
  const lastPostTime = useActivityStore((s) => s.lastPostTime);
  const eventsByKind = useEventStore((s) => s.eventsByKind);

  // Pre-compute activity counts per cluster
  const clusterActivity = useMemo(() => {
    const twoHoursAgo = Math.floor(Date.now() / 1000) - 7200;
    const noteMap = eventsByKind.get(NOSTR_KIND.TEXT_NOTE);
    const map = new Map<
      string,
      { active: number; noteCount: number }
    >();

    for (const cluster of clusters) {
      let active = 0;
      let noteCount = 0;
      for (const pk of cluster.memberPubkeys) {
        const last = lastPostTime.get(pk);
        if (last && last > twoHoursAgo) active++;
      }
      if (noteMap) {
        for (const ev of noteMap.values()) {
          if (cluster.memberPubkeys.has(ev.pubkey)) noteCount++;
        }
      }
      map.set(cluster.id, { active, noteCount });
    }
    return map;
  }, [clusters, lastPostTime, eventsByKind]);

  if (clusters.length === 0) return null;

  return (
    <div className="fixed top-14 right-6 z-50 pointer-events-auto">
      <div className="bg-[#0a0a12]/80 border border-white/10 rounded-lg p-3 max-w-sm">
        <div className="font-mono text-xs text-white/50 mb-2 uppercase tracking-wider">
          Clusters
        </div>
        <div className="flex flex-col gap-1.5">
          {clusters.map((cluster) => {
            const activity = clusterActivity.get(cluster.id);
            const isSelected = selectedClusterId === cluster.id;

            return (
              <button
                key={cluster.id}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-md transition-all duration-150 hover:brightness-125 text-left w-full"
                style={{
                  borderWidth: 1,
                  borderStyle: "solid",
                  borderColor: isSelected
                    ? cluster.color
                    : `color-mix(in srgb, ${cluster.color} 30%, transparent)`,
                  backgroundColor: isSelected
                    ? `color-mix(in srgb, ${cluster.color} 20%, transparent)`
                    : "transparent",
                  boxShadow: isSelected
                    ? `0 0 12px ${cluster.color}40`
                    : "none",
                }}
                onClick={() =>
                  selectCluster(isSelected ? null : cluster.id)
                }
              >
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: cluster.color }}
                />
                <span
                  className="font-mono text-xs font-medium truncate"
                  style={{ color: cluster.color }}
                >
                  #{cluster.label}
                </span>
                <span className="font-mono text-[10px] text-white/30 shrink-0 ml-auto">
                  {cluster.memberPubkeys.size}
                </span>
                {activity && activity.active > 0 && (
                  <Badge
                    variant="secondary"
                    className="font-mono text-[10px] px-1.5 py-0 h-4 shrink-0"
                    style={{
                      color: cluster.color,
                      borderColor: `color-mix(in srgb, ${cluster.color} 40%, transparent)`,
                    }}
                  >
                    {activity.active} active
                  </Badge>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
