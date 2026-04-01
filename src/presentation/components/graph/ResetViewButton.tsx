"use client";

import { useUIStore } from "@/store/ui-store";

export function ResetViewButton() {
  const isCameraMoved = useUIStore((s) => s.isCameraMoved);
  const resetCamera = useUIStore((s) => s.resetCamera);

  if (!isCameraMoved) return null;

  return (
    <button
      onClick={resetCamera}
      className="fixed bottom-8 left-6 z-[100] flex items-center gap-2 bg-black/90 backdrop-blur-sm border border-[#00ff41]/20 rounded px-4 py-2.5 font-mono text-[11px] text-[#00ff41]/60 hover:text-[#00ff41] hover:border-[#00ff41]/40 transition-all duration-200 hover:bg-[#00ff41]/5 uppercase tracking-wider"
    >
      <svg
        width="14"
        height="14"
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
      [overview]
    </button>
  );
}
