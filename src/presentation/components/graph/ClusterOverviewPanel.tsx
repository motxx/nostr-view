"use client";

import { useMemo, useState } from "react";
import { useGraphStore } from "@/store/graph-store";
import { useUIStore } from "@/store/ui-store";
import { useEventStore } from "@/store/event-store";
import {
  findRepresentativeNotes,
  computeBridges,
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

  const allEvents = useMemo(() => [...eventsById.values()], [eventsById]);

  const bridges = useMemo(() => computeBridges(clusters), [clusters]);
  const connectivity = useMemo(
    () => clusterConnectivity(bridges),
    [bridges],
  );

  const myCluster = useMemo(
    () => (myPubkey ? findUserCluster(myPubkey, clusters) : null),
    [myPubkey, clusters],
  );

  // Sort clusters: user's cluster first, then by connectivity (most connected = closest)
  const sortedClusters = useMemo(() => {
    const sorted = [...clusters].sort((a, b) => {
      // User's cluster always first
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
    // Decode npub if needed
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

      {/* "You are here" */}
      <div className="px-3 py-2 border-b border-white/10">
        {myPubkey ? (
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
            <span className="font-mono text-[10px] text-green-400/70 truncate">
              You:{" "}
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
              className="text-white/20 hover:text-white/50 text-xs shrink-0"
            >
              ×
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
              className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 font-mono text-[10px] text-white/60 placeholder:text-white/20 outline-none focus:border-white/20"
            />
            <button
              type="submit"
              className="font-mono text-[10px] text-white/40 hover:text-white/70 px-2 py-1 border border-white/10 rounded hover:bg-white/5"
            >
              Set
            </button>
          </form>
        )}
      </div>

      {/* Cluster list */}
      <div className="flex-1 overflow-y-auto">
        {summaries.length === 0 && (
          <div className="font-mono text-xs text-white/30 text-center py-8">
            Waiting for data...
          </div>
        )}

        {summaries.map(({ cluster, notes, bridges: clusterBridges }) => {
          const isMyCluster = myCluster?.id === cluster.id;

          return (
            <div
              key={cluster.id}
              className={`border-b border-white/5 hover:bg-white/[0.03] transition-colors ${
                isMyCluster ? "bg-white/[0.04]" : ""
              }`}
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
                {isMyCluster && (
                  <span className="font-mono text-[9px] text-green-400/60 shrink-0">
                    YOU
                  </span>
                )}
                <span className="font-mono text-[10px] text-white/30 ml-auto shrink-0">
                  {cluster.memberPubkeys.size}
                </span>
              </button>

              {/* Representative notes */}
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

              {/* Bridge people */}
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
    </div>
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
      <div className="font-mono text-[9px] text-white/25 mb-1 uppercase tracking-wider">
        Bridges
      </div>
      {bridges.slice(0, 3).map((bridge) => {
        const other = clusters.find((c) => c.id === bridge.targetClusterId);
        if (!other) return null;
        return (
          <div key={bridge.targetClusterId} className="mb-1.5">
            <div className="flex items-center gap-1 mb-0.5">
              <span className="font-mono text-[10px] text-white/30">↔</span>
              <span
                className="font-mono text-[10px]"
                style={{ color: other.color }}
              >
                {other.label}
              </span>
              <span className="font-mono text-[9px] text-white/20">
                {bridge.sharedCount}
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
                    className="inline-flex items-center gap-1 bg-white/[0.03] hover:bg-white/[0.06] rounded px-1.5 py-0.5 transition-colors"
                  >
                    {p?.picture && (
                      <img
                        src={p.picture}
                        alt=""
                        className="w-3 h-3 rounded-full object-cover"
                      />
                    )}
                    <span className="font-mono text-[9px] text-white/40">
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
