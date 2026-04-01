"use client";

import { useUIStore } from "@/store/ui-store";
import { useGraphStore } from "@/store/graph-store";
import { useEventStore } from "@/store/event-store";
import { useActivityStore } from "@/store/activity-store";
import { NOSTR_KIND } from "@/lib/nostr-kinds";
import { primalProfileUrl, primalNoteUrl } from "@/lib/nostr-url";
import { useMemo } from "react";

function ExternalLinkIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0">
      <path d="M9 6.5V9.5C9 10.05 8.55 10.5 8 10.5H2.5C1.95 10.5 1.5 10.05 1.5 9.5V4C1.5 3.45 1.95 3 2.5 3H5.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M7.5 1.5H10.5V4.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M5 7L10.5 1.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function NodeDetailCard() {
  const selectedNodeId = useUIStore((s) => s.selectedNodeId);
  const selectNode = useUIStore((s) => s.selectNode);
  const nodes = useGraphStore((s) => s.nodes);
  const profiles = useEventStore((s) => s.profiles);
  const eventsByAuthor = useEventStore((s) => s.eventsByAuthor);
  const lastPostTime = useActivityStore((s) => s.lastPostTime);

  const node = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId),
    [nodes, selectedNodeId],
  );

  const profile = selectedNodeId ? profiles.get(selectedNodeId) : undefined;

  const latestNote = useMemo(() => {
    if (!selectedNodeId) return undefined;
    const authorEvents = eventsByAuthor.get(selectedNodeId);
    if (!authorEvents) return undefined;
    let latest:
      | { id: string; content: string; created_at: number }
      | undefined;
    for (const ev of authorEvents.values()) {
      if (ev.kind !== NOSTR_KIND.TEXT_NOTE) continue;
      if (!latest || ev.created_at > latest.created_at) {
        latest = ev;
      }
    }
    return latest;
  }, [selectedNodeId, eventsByAuthor]);

  if (!selectedNodeId || !node) return null;

  const displayName =
    profile?.displayName || profile?.name || node.id.slice(0, 12) + "...";
  const lastActive = lastPostTime.get(selectedNodeId);
  const timeAgo = lastActive ? formatTimeAgo(lastActive) : "unknown";

  return (
    <div className="fixed top-20 left-6 z-[100] w-80 pointer-events-auto">
      <div className="osint-panel bg-black/90 backdrop-blur-md border border-[#00ff41]/20 rounded p-0 shadow-2xl shadow-[#00ff41]/5">
        {/* Classification header */}
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#00ff41]/15 bg-[#00ff41]/5">
          <span className="font-mono text-[9px] text-[#00ff41]/60 uppercase tracking-[0.2em]">
            subject profile
          </span>
          <button
            onClick={() => selectNode(null)}
            className="text-[#00ff41]/30 hover:text-[#00ff41]/60 text-xs leading-none"
          >
            [×]
          </button>
        </div>

        {/* Subject info */}
        <div className="flex items-start gap-3 px-3 py-3">
          <a
            href={primalProfileUrl(selectedNodeId)}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0"
          >
            {profile?.picture ? (
              <img
                src={profile.picture}
                alt=""
                className="w-12 h-12 rounded border border-[#00ff41]/20 object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded bg-[#00ff41]/10 border border-[#00ff41]/20" />
            )}
          </a>
          <div className="min-w-0 flex-1">
            <a
              href={primalProfileUrl(selectedNodeId)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-sm text-[#00ff41] font-medium truncate block hover:text-[#0ff] transition-colors"
            >
              {displayName}
            </a>
            {profile?.nip05 && (
              <div className="font-mono text-[10px] text-[#0ff]/40 truncate">
                {profile.nip05}
              </div>
            )}
            <div className="font-mono text-[10px] text-white/25 mt-0.5">
              LAST ACTIVE: <span className="text-[#00ff41]/50">{timeAgo}</span>
            </div>
          </div>
        </div>

        {/* Metrics grid */}
        <div className="grid grid-cols-4 gap-px mx-3 mb-3 border border-[#00ff41]/10 rounded overflow-hidden">
          <Stat label="SCORE" value={node.influenceScore.toFixed(1)} />
          <Stat label="NOTES" value={String(node.noteCount)} />
          <Stat label="REACT" value={String(node.reactionCount)} />
          <Stat label="RPST" value={String(node.repostCount)} />
        </div>

        {/* Latest intercept */}
        {latestNote && (
          <div className="border-t border-[#00ff41]/10 px-3 py-2.5">
            <div className="font-mono text-[9px] text-[#0ff]/40 mb-1 uppercase tracking-wider">
              latest intercept
            </div>
            <div className="font-mono text-[10px] text-[#00ff41]/60 leading-relaxed line-clamp-4 break-all">
              {latestNote.content}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="border-t border-[#00ff41]/10 px-3 py-2.5 flex gap-2">
          <a
            href={primalProfileUrl(selectedNodeId)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded bg-[#00ff41]/5 border border-[#00ff41]/20 font-mono text-[10px] text-[#00ff41]/60 hover:bg-[#00ff41]/10 hover:text-[#00ff41] transition-colors uppercase tracking-wider"
          >
            Profile
            <ExternalLinkIcon />
          </a>
          {latestNote && (
            <a
              href={primalNoteUrl(latestNote.id)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded bg-[#00ff41]/5 border border-[#00ff41]/20 font-mono text-[10px] text-[#00ff41]/60 hover:bg-[#00ff41]/10 hover:text-[#00ff41] transition-colors uppercase tracking-wider"
            >
              Source
              <ExternalLinkIcon />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center py-1.5 bg-[#00ff41]/[0.03]">
      <div className="font-mono text-sm text-[#00ff41]/80 font-medium tabular-nums">{value}</div>
      <div className="font-mono text-[8px] text-[#0ff]/30 uppercase tracking-wider">{label}</div>
    </div>
  );
}

function formatTimeAgo(unixSec: number): string {
  const diff = Math.floor(Date.now() / 1000) - unixSec;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
