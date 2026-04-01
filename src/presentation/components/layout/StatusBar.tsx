"use client";

import { useEventStore } from "@/store/event-store";
import { useGraphStore } from "@/store/graph-store";

export function StatusBar() {
  const connectionStatus = useEventStore((s) => s.connectionStatus);
  const totalEvents = useEventStore((s) => s.totalEvents);
  const nodeCount = useGraphStore((s) => s.nodes.length);
  const clusterCount = useGraphStore((s) => s.clusters.length);

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
        </div>
        {/* Right: system status */}
        <div className="flex items-center gap-3">
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
