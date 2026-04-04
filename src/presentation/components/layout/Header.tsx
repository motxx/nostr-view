"use client";

import { useSyncExternalStore } from "react";

const fmt = () =>
  new Date().toISOString().replace("T", " ").slice(0, 19) + "Z";

function subscribe(cb: () => void) {
  const id = setInterval(cb, 1000);
  return () => clearInterval(id);
}

function useSystemClock() {
  return useSyncExternalStore(subscribe, fmt, () => "");
}

export function Header() {
  const utc = useSystemClock();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 pointer-events-none">
      {/* Classification banner */}
      <div className="bg-[#00ff41]/10 border-b border-[#00ff41]/20 px-4 py-0.5 flex items-center justify-between pointer-events-auto">
        <span className="font-mono text-[9px] tracking-[0.3em] text-[#00ff41]/50 uppercase">
          nostr protocol visualizer
        </span>
        <span className="font-mono text-[9px] text-[#00ff41]/40 tabular-nums">
          {utc}
        </span>
      </div>
      {/* Main header */}
      <div className="flex items-center justify-between px-6 py-2 pointer-events-auto">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 bg-[#00ff41] rounded-full osint-pulse" />
          <h1 className="font-mono text-sm font-bold tracking-[0.2em] text-[#00ff41]/90 uppercase">
            nostr<span className="text-[#0ff]">::</span>view
          </h1>
          <span className="font-mono text-[9px] text-white/20 border border-white/10 rounded px-1.5 py-0.5 uppercase">
            v2.0
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="font-mono text-[9px] text-[#00ff41]/30 uppercase tracking-wider">
            network analysis active
          </span>
          <span className="font-mono text-[10px] text-[#0ff]/40 osint-blink">
            ▊
          </span>
        </div>
      </div>
      {/* Bottom rule */}
      <div className="h-px bg-gradient-to-r from-transparent via-[#00ff41]/20 to-transparent" />
    </header>
  );
}
