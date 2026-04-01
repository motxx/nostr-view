"use client";

import { useMemo, useState } from "react";
import { useGraphStore } from "@/store/graph-store";
import { useUIStore } from "@/store/ui-store";
import { useEventStore } from "@/store/event-store";
import {
  findRepresentativeNotes,
  findUserCluster,
  clusterConnectivity,
  type BridgeInfo,
} from "@/domain/services/cluster-summary";
import {
  CLUSTER_STRATEGY_LABELS,
  type ClusterStrategy,
} from "@/domain/services/cluster-strategy";
import { primalNoteUrl, primalProfileUrl } from "@/lib/nostr-url";
import { nip19 } from "nostr-tools";
import { SidebarPanel } from "@/presentation/components/layout/SidebarPanel";

const STRATEGIES: ClusterStrategy[] = ["topic", "interaction", "language"];

export function ClusterOverviewPanel() {
  const clusters = useGraphStore((s) => s.clusters);
  const clusterStrategy = useUIStore((s) => s.clusterStrategy);
  const setClusterStrategy = useUIStore((s) => s.setClusterStrategy);
  const selectCluster = useUIStore((s) => s.selectCluster);
  const flyToClusterFn = useUIStore((s) => s.flyToClusterFn);
  const myPubkey = useUIStore((s) => s.myPubkey);
  const eventsById = useEventStore((s) => s.eventsById);
  const profiles = useEventStore((s) => s.profiles);

  const [pubkeyInput, setPubkeyInput] = useState("");

  const bridges = useGraphStore((s) => s.bridges);
  const explorationMap = useGraphStore((s) => s.explorationMap);

  const allEvents = useMemo(() => [...eventsById.values()], [eventsById]);

  const connectivity = useMemo(
    () => clusterConnectivity(bridges),
    [bridges],
  );

  const myCluster = useMemo(
    () => (myPubkey ? findUserCluster(myPubkey, clusters) : null),
    [myPubkey, clusters],
  );

  const sortedClusters = useMemo(() => {
    const sorted = [...clusters].sort((a, b) => {
      if (myCluster) {
        if (a.id === myCluster.id) return -1;
        if (b.id === myCluster.id) return 1;
      }
      return (connectivity.get(b.id) ?? 0) - (connectivity.get(a.id) ?? 0);
    });
    return sorted;
  }, [clusters, myCluster, connectivity]);

  const summaries = useMemo(
    () =>
      sortedClusters.map((cluster) => ({
        cluster,
        notes: findRepresentativeNotes(cluster, allEvents, 3),
        bridges: bridges.get(cluster.id) ?? [],
      })),
    [sortedClusters, allEvents, bridges],
  );

  const handleClusterClick = (clusterId: string) => {
    selectCluster(clusterId);
    flyToClusterFn?.(clusterId);
  };

  const handlePubkeySubmit = () => {
    let hex = pubkeyInput.trim();
    if (!hex) {
      useUIStore.getState().setMyPubkey(null);
      return;
    }
    if (hex.startsWith("npub")) {
      try {
        const decoded = nip19.decode(hex);
        if (decoded.type === "npub") hex = decoded.data;
      } catch {
        return;
      }
    }
    if (/^[0-9a-f]{64}$/i.test(hex)) {
      useUIStore.getState().setMyPubkey(hex);
    }
  };

  return (
    <SidebarPanel title="cluster monitoring">
      {/* Strategy tabs */}
      <div className="flex items-center gap-1 p-2 border-b border-[#00ff41]/10">
        {STRATEGIES.map((s) => (
          <button
            key={s}
            onClick={() => {
              setClusterStrategy(s);
              useUIStore.getState().reheatSimulation();
            }}
            className={`flex-1 font-mono text-[10px] px-2 py-1.5 rounded transition-colors uppercase tracking-wider ${
              clusterStrategy === s
                ? "bg-[#00ff41]/15 text-[#00ff41] border border-[#00ff41]/30"
                : "text-white/30 hover:text-[#00ff41]/60 hover:bg-[#00ff41]/5 border border-transparent"
            }`}
          >
            {CLUSTER_STRATEGY_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Operator identification */}
      <div className="px-3 py-2 border-b border-[#00ff41]/10">
        {myPubkey ? (
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#00ff41] osint-pulse shrink-0" />
            <span className="font-mono text-[10px] text-[#00ff41]/60 truncate">
              OPR:{" "}
              {profiles.get(myPubkey)?.displayName ||
                profiles.get(myPubkey)?.name ||
                myPubkey.slice(0, 12) + "…"}
            </span>
            {myCluster && (
              <span
                className="font-mono text-[10px] ml-auto shrink-0"
                style={{ color: myCluster.color }}
              >
                ● {myCluster.label}
              </span>
            )}
            <button
              onClick={() => {
                useUIStore.getState().setMyPubkey(null);
                setPubkeyInput("");
              }}
              className="text-[#00ff41]/20 hover:text-[#00ff41]/50 text-xs shrink-0 font-mono"
            >
              [×]
            </button>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handlePubkeySubmit();
            }}
            className="flex gap-1"
          >
            <input
              type="text"
              value={pubkeyInput}
              onChange={(e) => setPubkeyInput(e.target.value)}
              placeholder="npub or hex pubkey"
              className="flex-1 bg-[#00ff41]/5 border border-[#00ff41]/15 rounded px-2 py-1 font-mono text-[10px] text-[#00ff41]/60 placeholder:text-[#00ff41]/15 outline-none focus:border-[#00ff41]/30"
            />
            <button
              type="submit"
              className="font-mono text-[10px] text-[#00ff41]/40 hover:text-[#00ff41]/70 px-2 py-1 border border-[#00ff41]/15 rounded hover:bg-[#00ff41]/5 uppercase"
            >
              Set
            </button>
          </form>
        )}
      </div>

      {/* Coverage bar + recommendations (Feature 2) */}
      {explorationMap && (
        <div className="px-3 py-2 border-b border-[#00ff41]/10">
          <div className="flex items-center justify-between mb-1">
            <span className="font-mono text-[9px] text-[#0ff]/30 uppercase tracking-[0.2em]">
              network coverage
            </span>
            <span className="font-mono text-[10px] text-[#00ff41]/70 tabular-nums">
              {Math.round(explorationMap.coverage * 100)}%
            </span>
          </div>
          <div className="h-1 bg-[#00ff41]/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#00ff41]/50 rounded-full transition-all duration-500"
              style={{ width: `${explorationMap.coverage * 100}%` }}
            />
          </div>
          {explorationMap.recommendations.length > 0 && (
            <div className="mt-2">
              <span className="font-mono text-[8px] text-[#0ff]/25 uppercase tracking-[0.2em]">
                follow recommendations
              </span>
              {explorationMap.recommendations.slice(0, 3).map((rec) => {
                const profile = profiles.get(rec.bridgePubkey);
                const name =
                  profile?.displayName ||
                  profile?.name ||
                  rec.bridgePubkey.slice(0, 8) + "…";
                const targetCluster = clusters.find(
                  (c) => c.id === rec.targetClusterId,
                );
                return (
                  <div
                    key={rec.targetClusterId}
                    className="flex items-center gap-1.5 mt-1"
                  >
                    <a
                      href={primalProfileUrl(rec.bridgePubkey)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 bg-[#00ff41]/[0.03] hover:bg-[#00ff41]/[0.08] border border-[#00ff41]/5 rounded px-1.5 py-0.5 transition-colors"
                    >
                      {profile?.picture && (
                        <img
                          src={profile.picture}
                          alt=""
                          className="w-3 h-3 rounded object-cover"
                        />
                      )}
                      <span className="font-mono text-[9px] text-[#00ff41]/50">
                        {name}
                      </span>
                    </a>
                    <span className="font-mono text-[9px] text-white/20">→</span>
                    {targetCluster && (
                      <span
                        className="font-mono text-[9px]"
                        style={{ color: targetCluster.color }}
                      >
                        {targetCluster.label}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Cluster list */}
      <div className="flex-1 overflow-y-auto osint-scroll">
        {summaries.length === 0 && (
          <div className="font-mono text-[10px] text-[#00ff41]/25 text-center py-8 uppercase tracking-wider">
            Awaiting signal data...
          </div>
        )}

        {summaries.map(({ cluster, notes, bridges: clusterBridges }) => {
          const isMyCluster = myCluster?.id === cluster.id;
          const isUnexplored =
            explorationMap?.reachability.get(cluster.id) === Infinity;

          return (
            <div
              key={cluster.id}
              className={`border-b border-[#00ff41]/5 hover:bg-[#00ff41]/[0.03] transition-colors ${
                isMyCluster ? "bg-[#00ff41]/[0.04] border-l-2 border-l-[#00ff41]/30" : ""
              }`}
            >
              {/* Cluster header */}
              <button
                onClick={() => handleClusterClick(cluster.id)}
                className="w-full px-3 py-2.5 text-left flex items-center gap-2"
              >
                <div
                  className="w-2 h-2 rounded-sm shrink-0"
                  style={{ backgroundColor: cluster.color }}
                />
                <span
                  className="font-mono text-[11px] font-medium truncate"
                  style={{ color: cluster.color }}
                >
                  {cluster.label}
                </span>
                {isMyCluster && (
                  <span className="font-mono text-[8px] text-[#00ff41]/60 shrink-0 border border-[#00ff41]/20 rounded px-1 uppercase">
                    opr
                  </span>
                )}
                {isUnexplored && (
                  <span className="font-mono text-[8px] text-red-400/80 shrink-0 border border-red-400/30 rounded px-1 uppercase">
                    unexplored
                  </span>
                )}
                <span className="font-mono text-[10px] text-white/20 ml-auto shrink-0 tabular-nums">
                  [{cluster.memberPubkeys.size}]
                </span>
              </button>

              {/* Representative signals */}
              {notes.length > 0 && (
                <div className="px-3 pb-2 space-y-1">
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
                        className="block rounded bg-[#00ff41]/[0.02] hover:bg-[#00ff41]/[0.06] border border-[#00ff41]/5 hover:border-[#00ff41]/15 px-2 py-1.5 transition-colors"
                      >
                        <div className="font-mono text-[9px] text-[#0ff]/30 mb-0.5">
                          {name}
                        </div>
                        <div className="font-mono text-[10px] text-[#00ff41]/50 leading-relaxed line-clamp-2">
                          {note.content.slice(0, 140)}
                        </div>
                      </a>
                    );
                  })}
                </div>
              )}

              {/* Bridge connections */}
              {clusterBridges.length > 0 && (
                <BridgeSection
                  bridges={clusterBridges}
                  clusters={clusters}
                  profiles={profiles}
                />
              )}
            </div>
          );
        })}
      </div>
    </SidebarPanel>
  );
}

function BridgeSection({
  bridges,
  clusters,
  profiles,
}: {
  bridges: BridgeInfo[];
  clusters: { id: string; label: string; color: string }[];
  profiles: Map<string, { name?: string; displayName?: string; picture?: string }>;
}) {
  return (
    <div className="px-3 pb-2.5">
      <div className="font-mono text-[8px] text-[#0ff]/25 mb-1 uppercase tracking-[0.2em]">
        cross-links
      </div>
      {bridges.slice(0, 3).map((bridge) => {
        const other = clusters.find((c) => c.id === bridge.targetClusterId);
        if (!other) return null;
        return (
          <div key={bridge.targetClusterId} className="mb-1.5">
            <div className="flex items-center gap-1 mb-0.5">
              <span className="font-mono text-[10px] text-[#00ff41]/25">⟷</span>
              <span
                className="font-mono text-[10px]"
                style={{ color: other.color }}
              >
                {other.label}
              </span>
              <span className="font-mono text-[9px] text-white/15 tabular-nums">
                [{bridge.sharedCount}]
              </span>
            </div>
            <div className="flex flex-wrap gap-1 ml-3">
              {bridge.bridgePubkeys.slice(0, 3).map((pk) => {
                const p = profiles.get(pk);
                const name =
                  p?.displayName || p?.name || pk.slice(0, 8) + "…";
                return (
                  <a
                    key={pk}
                    href={primalProfileUrl(pk)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 bg-[#00ff41]/[0.03] hover:bg-[#00ff41]/[0.08] border border-[#00ff41]/5 rounded px-1.5 py-0.5 transition-colors"
                  >
                    {p?.picture && (
                      <img
                        src={p.picture}
                        alt=""
                        className="w-3 h-3 rounded object-cover"
                      />
                    )}
                    <span className="font-mono text-[9px] text-[#00ff41]/35">
                      {name}
                    </span>
                  </a>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
