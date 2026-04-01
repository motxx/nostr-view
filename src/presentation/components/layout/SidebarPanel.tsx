"use client";

interface SidebarPanelProps {
  title: string;
  onBack?: () => void;
  children: React.ReactNode;
}

export function SidebarPanel({ title, onBack, children }: SidebarPanelProps) {
  return (
    <div className="w-80 h-full bg-black/90 border-l border-[#00ff41]/15 flex flex-col overflow-hidden">
      {/* Panel header */}
      <div className="px-3 py-1.5 border-b border-[#00ff41]/15 bg-[#00ff41]/5 flex items-center gap-2">
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
  );
}
