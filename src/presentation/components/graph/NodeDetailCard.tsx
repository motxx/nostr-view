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
    <div className="fixed bottom-6 right-6 z-[100] w-80 pointer-events-auto">
      <div className="bg-black/85 backdrop-blur-md border border-white/10 rounded-xl p-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
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
                className="w-12 h-12 rounded-full object-cover border border-white/20"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-blue-500/30 border border-white/20" />
            )}
          </a>
          <div className="min-w-0 flex-1">
            <a
              href={primalProfileUrl(selectedNodeId)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-sm text-white font-medium truncate block hover:text-blue-300 transition-colors"
            >
              {displayName}
            </a>
            {profile?.nip05 && (
              <div className="font-mono text-xs text-white/50 truncate">
                {profile.nip05}
              </div>
            )}
            <div className="font-mono text-xs text-white/30 mt-0.5">
              Last active: {timeAgo}
            </div>
          </div>
          <button
            onClick={() => selectNode(null)}
            className="text-white/30 hover:text-white/60 text-lg leading-none shrink-0"
          >
            ×
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          <Stat label="Score" value={node.influenceScore.toFixed(1)} />
          <Stat label="Notes" value={String(node.noteCount)} />
          <Stat label="Reacts" value={String(node.reactionCount)} />
          <Stat label="Reposts" value={String(node.repostCount)} />
        </div>

        {/* Latest note */}
        {latestNote && (
          <div className="border-t border-white/10 pt-3">
            <div className="font-mono text-xs text-white/40 mb-1">
              Latest post
            </div>
            <div className="font-mono text-xs text-white/70 leading-relaxed line-clamp-4 break-all mb-2">
              {latestNote.content}
            </div>
          </div>
        )}

        {/* Primal buttons */}
        <div className="border-t border-white/10 pt-3 mt-1 flex gap-2">
          <a
            href={primalProfileUrl(selectedNodeId)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-purple-500/15 border border-purple-400/30 font-mono text-xs text-purple-300 hover:bg-purple-500/25 hover:text-purple-200 transition-colors"
          >
            Profile
            <ExternalLinkIcon />
          </a>
          {latestNote && (
            <a
              href={primalNoteUrl(latestNote.id)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-purple-500/15 border border-purple-400/30 font-mono text-xs text-purple-300 hover:bg-purple-500/25 hover:text-purple-200 transition-colors"
            >
              Latest Note
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
    <div className="text-center">
      <div className="font-mono text-sm text-white font-medium">{value}</div>
      <div className="font-mono text-[10px] text-white/40">{label}</div>
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
