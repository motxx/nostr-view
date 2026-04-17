"use client";

import { useUIStore } from "@/store/ui-store";

interface SidebarPanelProps {
  title: string;
  onBack?: () => void;
  children: React.ReactNode;
}

export function SidebarPanel({ title, onBack, children }: SidebarPanelProps) {
  const isSidebarOpen = useUIStore((s) => s.isSidebarOpen);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);

  return (
    <>
      {/* Mobile backdrop */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-[199] md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <div
        className={`fixed inset-x-0 bottom-0 h-[70vh] z-[200] transition-transform duration-300 ${isSidebarOpen ? "translate-y-0" : "translate-y-full"} md:static md:translate-y-0 md:h-full md:transition-none w-full md:w-80 bg-black/95 md:bg-black/90 border-t md:border-t-0 md:border-l border-[#00ff41]/15 flex flex-col overflow-hidden rounded-t-xl md:rounded-none`}
      >
        {/* Panel header */}
        <div className="px-3 py-1.5 border-b border-[#00ff41]/15 bg-[#00ff41]/5 flex items-center gap-2">
          {/* Mobile close — always closes the drawer */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="font-mono text-[9px] text-[#00ff41]/40 hover:text-[#00ff41]/70 transition-colors md:hidden"
          >
            [×]
          </button>
          {/* Back button — mobile + desktop */}
          {onBack && (
            <button
              onClick={onBack}
              className="font-mono text-[9px] text-[#00ff41]/40 hover:text-[#00ff41]/70 transition-colors"
            >
              [←]
            </button>
          )}
          <span className="font-mono text-[9px] text-[#00ff41]/50 uppercase tracking-[0.2em]">
            {title}
          </span>
        </div>
        {children}
      </div>
    </>
  );
}
