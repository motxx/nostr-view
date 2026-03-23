"use client";

import { useUIStore } from "@/store/ui-store";

export function ResetViewButton() {
  const selectedNodeId = useUIStore((s) => s.selectedNodeId);
  const selectedClusterId = useUIStore((s) => s.selectedClusterId);
  const isZoomedIn = useUIStore((s) => s.isZoomedIn);
  const resetCamera = useUIStore((s) => s.resetCamera);

  // Show when zoomed in via pinch/wheel or when a node/cluster is selected
  if (!selectedNodeId && !selectedClusterId && !isZoomedIn) return null;

  return (
    <button
      onClick={resetCamera}
      className="fixed bottom-6 left-6 z-[100] flex items-center gap-2 bg-black/80 backdrop-blur-sm border border-white/10 rounded-lg px-4 py-2.5 font-mono text-sm text-white/70 hover:text-white hover:border-white/25 transition-all duration-200 hover:bg-white/5"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        className="shrink-0"
      >
        <path
          d="M2 8.5V3.5C2 2.95 2.45 2.5 3 2.5H13C13.55 2.5 14 2.95 14 3.5V12.5C14 13.05 13.55 13.5 13 13.5H8"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M5 13.5L1.5 10L5 6.5"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <line
          x1="1.5"
          y1="10"
          x2="10"
          y2="10"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </svg>
      Overview
    </button>
  );
}
