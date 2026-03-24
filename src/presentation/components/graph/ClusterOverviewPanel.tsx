"use client";

import { useMemo } from "react";
import { useGraphStore } from "@/store/graph-store";
import { useUIStore } from "@/store/ui-store";
import { useEventStore } from "@/store/event-store";
import {
  findRepresentativeNotes,
  computeBridges,
} from "@/domain/services/cluster-summary";
import {
  CLUSTER_STRATEGY_LABELS,
  type ClusterStrategy,
} from "@/domain/services/cluster-strategy";
import { primalNoteUrl } from "@/lib/nostr-url";

const STRATEGIES: ClusterStrategy[] = ["topic", "interaction", "language"];

export function ClusterOverviewPanel() {
  const clusters = useGraphStore((s) => s.clusters);
  const clusterStrategy = useUIStore((s) => s.clusterStrategy);
  const setClusterStrategy = useUIStore((s) => s.setClusterStrategy);
  const selectCluster = useUIStore((s) => s.selectCluster);
  const flyToClusterFn = useUIStore((s) => s.flyToClusterFn);
  const eventsById = useEventStore((s) => s.eventsById);
  const profiles = useEventStore((s) => s.profiles);

  const allEvents = useMemo(() => [...eventsById.values()], [eventsById]);

  const summaries = useMemo(() => {
    const bridges = computeBridges(clusters);
    return clusters.map((cluster) => ({
      cluster,
      notes: findRepresentativeNotes(cluster, allEvents, 3),
      bridges: bridges.get(cluster.id) ?? new Map<string, number>(),
    }));
  }, [clusters, allEvents]);

  const handleClusterClick = (clusterId: string) => {
    selectCluster(clusterId);
    flyToClusterFn?.(clusterId);
  };

  return (
    <div className="w-80 h-full bg-[#0a0a12]/90 border-l border-white/10 flex flex-col overflow-hidden">
      {/* Strategy tabs */}
      <div className="flex items-center gap-1 p-3 border-b border-white/10">
        {STRATEGIES.map((s) => (
          <button
            key={s}
            onClick={() => {
              setClusterStrategy(s);
              useUIStore.getState().reheatSimulation();
            }}
            className={`flex-1 font-mono text-[11px] px-2 py-1.5 rounded transition-colors ${
              clusterStrategy === s
                ? "bg-white/15 text-white"
                : "text-white/40 hover:text-white/60 hover:bg-white/5"
            }`}
          >
            {CLUSTER_STRATEGY_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Cluster list */}
      <div className="flex-1 overflow-y-auto">
        {summaries.length === 0 && (
          <div className="font-mono text-xs text-white/30 text-center py-8">
            Waiting for data...
          </div>
        )}

        {summaries.map(({ cluster, notes, bridges }) => {
          const totalBridges = [...bridges.values()].reduce(
            (sum, n) => sum + n,
            0,
          );

          return (
            <div
              key={cluster.id}
              className="border-b border-white/5 hover:bg-white/[0.03] transition-colors"
            >
              {/* Cluster header */}
              <button
                onClick={() => handleClusterClick(cluster.id)}
                className="w-full px-3 py-2.5 text-left flex items-center gap-2"
              >
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: cluster.color }}
                />
                <span
                  className="font-mono text-xs font-medium truncate"
                  style={{ color: cluster.color }}
                >
                  {cluster.label}
                </span>
                <span className="font-mono text-[10px] text-white/30 ml-auto shrink-0">
                  {cluster.memberPubkeys.size}
                </span>
                {totalBridges > 0 && (
                  <span className="font-mono text-[10px] text-white/20 shrink-0">
                    {totalBridges} bridges
                  </span>
                )}
              </button>

              {/* Representative notes */}
              {notes.length > 0 && (
                <div className="px-3 pb-2.5 space-y-1.5">
                  {notes.map((note) => {
                    const profile = profiles.get(note.pubkey);
                    const name =
                      profile?.displayName ||
                      profile?.name ||
                      note.pubkey.slice(0, 8) + "…";
                    return (
                      <a
                        key={note.id}
                        href={primalNoteUrl(note.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block rounded bg-white/[0.03] hover:bg-white/[0.06] px-2 py-1.5 transition-colors"
                      >
                        <div className="font-mono text-[10px] text-white/40 mb-0.5">
                          {name}
                        </div>
                        <div className="font-mono text-[11px] text-white/60 leading-relaxed line-clamp-2">
                          {note.content.slice(0, 140)}
                        </div>
                      </a>
                    );
                  })}
                </div>
              )}

              {/* Bridge info */}
              {bridges.size > 0 && (
                <div className="px-3 pb-2 flex flex-wrap gap-1">
                  {[...bridges.entries()].slice(0, 3).map(([otherId, count]) => {
                    const other = clusters.find((c) => c.id === otherId);
                    if (!other) return null;
                    return (
                      <span
                        key={otherId}
                        className="font-mono text-[9px] text-white/25 bg-white/[0.03] rounded px-1.5 py-0.5"
                      >
                        ↔ {other.label}{" "}
                        <span style={{ color: other.color }}>{count}</span>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
