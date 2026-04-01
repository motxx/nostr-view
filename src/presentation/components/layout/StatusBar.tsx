"use client";

import { useSyncExternalStore } from "react";
import { useEventStore } from "@/store/event-store";
import { useGraphStore } from "@/store/graph-store";
import { useActivityStore } from "@/store/activity-store";
import { useUIStore } from "@/store/ui-store";

/** Provides current time (unix seconds) that ticks every 30 seconds. */
let _sbNowSec = Math.floor(Date.now() / 1000);
const _sbListeners = new Set<() => void>();
if (typeof window !== "undefined") {
  setInterval(() => {
    _sbNowSec = Math.floor(Date.now() / 1000);
    for (const l of _sbListeners) l();
  }, 30_000);
}
function sbSubscribe(cb: () => void) {
  _sbListeners.add(cb);
  return () => { _sbListeners.delete(cb); };
}
function sbGetSnapshot() { return _sbNowSec; }
function sbGetServerSnapshot() { return 0; }

export function StatusBar() {
  const connectionStatus = useEventStore((s) => s.connectionStatus);
  const totalEvents = useEventStore((s) => s.totalEvents);
  const nodeCount = useGraphStore((s) => s.nodes.length);
  const clusterCount = useGraphStore((s) => s.clusters.length);
  const eventRate = useActivityStore((s) => s.eventRate);
  const explorationMap = useGraphStore((s) => s.explorationMap);
  const isLive = useUIStore((s) => s.isLive);
  const timeRange = useUIStore((s) => s.timeRange);

  // Subscribe to periodic ticks for time label updates
  const nowSec = useSyncExternalStore(sbSubscribe, sbGetSnapshot, sbGetServerSnapshot);
  const timeLabel = (() => {
    if (isLive || !timeRange) return "LIVE";
    const diffMin = Math.round((nowSec - timeRange[1]) / 60);
    if (diffMin <= 0) return "LIVE";
    if (diffMin < 60) return `-${diffMin}m`;
    return `-${Math.floor(diffMin / 60)}h${diffMin % 60}m`;
  })();

  const isConnected = connectionStatus === "connected";
  const statusColor = isConnected
    ? "bg-[#00ff41]"
    : connectionStatus === "connecting"
      ? "bg-yellow-500"
      : "bg-red-500";

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
      {/* Top rule */}
      <div className="h-px bg-gradient-to-r from-transparent via-[#00ff41]/20 to-transparent" />
      <div className="flex items-center justify-between px-6 py-1.5 bg-black/60 backdrop-blur-sm">
        {/* Left: connection */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${statusColor} ${isConnected ? "osint-pulse" : "animate-pulse"}`} />
            <span className="font-mono text-[10px] text-[#00ff41]/60 uppercase tracking-wider">
              {connectionStatus}
            </span>
          </div>
          <div className="h-3 w-px bg-[#00ff41]/10" />
          <MetricCell label="SIG" value={totalEvents.toLocaleString()} />
          <div className="h-3 w-px bg-[#00ff41]/10" />
          <MetricCell label="NODES" value={String(nodeCount)} />
          <div className="h-3 w-px bg-[#00ff41]/10" />
          <MetricCell label="CLUSTERS" value={String(clusterCount)} />
          <div className="h-3 w-px bg-[#00ff41]/10" />
          <MetricCell label="EVT/S" value={eventRate.toFixed(1)} />
          {explorationMap && (
            <>
              <div className="h-3 w-px bg-[#00ff41]/10" />
              <MetricCell
                label="COV"
                value={`${Math.round(explorationMap.coverage * 100)}%`}
              />
            </>
          )}
        </div>
        {/* Right: time mode + system status */}
        <div className="flex items-center gap-3">
          <MetricCell
            label="TIME"
            value={timeLabel}
          />
          <div className="h-3 w-px bg-[#00ff41]/10" />
          <span className="font-mono text-[9px] text-white/15 uppercase tracking-wider">
            sys nominal
          </span>
          <span className="font-mono text-[10px] text-[#00ff41]/30 osint-blink">●</span>
        </div>
      </div>
    </footer>
  );
}

function MetricCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="font-mono text-[9px] text-[#0ff]/30 uppercase">{label}</span>
      <span className="font-mono text-[10px] text-[#00ff41]/70 tabular-nums">{value}</span>
    </div>
  );
}
