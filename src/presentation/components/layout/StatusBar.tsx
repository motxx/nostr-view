"use client";

import { useEventStore } from "@/store/event-store";
import { useGraphStore } from "@/store/graph-store";

export function StatusBar() {
  const connectionStatus = useEventStore((s) => s.connectionStatus);
  const totalEvents = useEventStore((s) => s.totalEvents);
  const nodeCount = useGraphStore((s) => s.nodes.length);
  const clusterCount = useGraphStore((s) => s.clusters.length);

  const statusColor =
    connectionStatus === "connected"
      ? "bg-green-500"
      : connectionStatus === "connecting"
        ? "bg-yellow-500"
        : "bg-red-500";

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-50 flex items-center gap-4 px-6 py-2 font-mono text-xs text-white/60 pointer-events-none">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${statusColor} animate-pulse`} />
        <span className="uppercase">{connectionStatus}</span>
      </div>
      <div className="h-3 w-px bg-white/20" />
      <span>{totalEvents.toLocaleString()} events</span>
      <div className="h-3 w-px bg-white/20" />
      <span>{nodeCount} nodes</span>
      <div className="h-3 w-px bg-white/20" />
      <span>{clusterCount} clusters</span>
    </footer>
  );
}
