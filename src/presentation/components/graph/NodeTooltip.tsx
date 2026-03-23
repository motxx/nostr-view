"use client";

import { useUIStore } from "@/store/ui-store";
import { useGraphStore } from "@/store/graph-store";
import { useEventStore } from "@/store/event-store";

export function NodeTooltip() {
  const hoveredNodeId = useUIStore((s) => s.hoveredNodeId);
  const nodes = useGraphStore((s) => s.nodes);
  const profiles = useEventStore((s) => s.profiles);

  if (!hoveredNodeId) return null;

  const node = nodes.find((n) => n.id === hoveredNodeId);
  if (!node) return null;

  const profile = profiles.get(hoveredNodeId);
  const displayName =
    profile?.displayName || profile?.name || node.id.slice(0, 12) + "...";

  return (
    <div className="fixed top-16 left-6 z-[100] pointer-events-none">
      <div className="bg-black/80 backdrop-blur-sm border border-white/10 rounded-lg px-4 py-3 max-w-xs">
        <div className="flex items-center gap-3">
          {profile?.picture && (
            <img
              src={profile.picture}
              alt=""
              className="w-10 h-10 rounded-full object-cover border border-white/20"
            />
          )}
          <div>
            <div className="font-mono text-sm text-white font-medium">
              {displayName}
            </div>
            {profile?.nip05 && (
              <div className="font-mono text-xs text-white/50">
                {profile.nip05}
              </div>
            )}
          </div>
        </div>
        <div className="mt-2 flex gap-3 font-mono text-xs text-white/40">
          <span>score: {node.influenceScore.toFixed(1)}</span>
        </div>
      </div>
    </div>
  );
}
