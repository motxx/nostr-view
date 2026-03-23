"use client";

import { useMemo } from "react";
import { useEventStore } from "@/store/event-store";
import { useGraphStore } from "@/store/graph-store";
import { NOSTR_KIND } from "@/lib/nostr-kinds";
import { primalNoteUrl, primalProfileUrl } from "@/lib/nostr-url";

/**
 * Always-visible live feed at the bottom of the screen.
 * Shows the latest notes streaming in, with cluster color coding.
 */
export function LiveFeed() {
  const eventsById = useEventStore((s) => s.eventsById);
  const profiles = useEventStore((s) => s.profiles);
  const clusters = useGraphStore((s) => s.clusters);

  const clusterLookup = useMemo(() => {
    const map = new Map<string, { color: string; label: string }>();
    for (const c of clusters) {
      for (const pk of c.memberPubkeys) {
        map.set(pk, { color: c.color, label: c.label });
      }
    }
    return map;
  }, [clusters]);

  const recentNotes = useMemo(() => {
    const notes: {
      id: string;
      pubkey: string;
      content: string;
      created_at: number;
    }[] = [];
    for (const ev of eventsById.values()) {
      if (ev.kind === NOSTR_KIND.TEXT_NOTE) {
        notes.push(ev);
      }
    }
    notes.sort((a, b) => b.created_at - a.created_at);
    return notes.slice(0, 30);
  }, [eventsById]);

  if (recentNotes.length === 0) return null;

  return (
    <div className="fixed bottom-10 left-0 right-0 z-50 pointer-events-none">
      <div className="max-h-48 overflow-hidden px-4">
        <div className="flex flex-col gap-1.5 items-start">
          {recentNotes.slice(0, 6).map((note) => {
            const profile = profiles.get(note.pubkey);
            const displayName =
              profile?.displayName ||
              profile?.name ||
              note.pubkey.slice(0, 8) + "…";
            const cluster = clusterLookup.get(note.pubkey);
            const elapsed = Math.floor(Date.now() / 1000) - note.created_at;
            const time =
              elapsed < 60
                ? `${elapsed}s`
                : elapsed < 3600
                  ? `${Math.floor(elapsed / 60)}m`
                  : `${Math.floor(elapsed / 3600)}h`;

            return (
              <div
                key={note.id}
                className="pointer-events-auto max-w-lg bg-black/70 backdrop-blur-sm border border-white/8 rounded-lg px-3 py-1.5 flex items-center gap-2 group hover:bg-black/85 transition-colors"
              >
                {cluster && (
                  <div
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: cluster.color }}
                    title={cluster.label}
                  />
                )}
                <a
                  href={primalProfileUrl(note.pubkey)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs text-white/60 hover:text-white shrink-0 transition-colors"
                >
                  {displayName}
                </a>
                <a
                  href={primalNoteUrl(note.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs text-white/40 truncate hover:text-white/70 transition-colors min-w-0"
                >
                  {note.content.slice(0, 120).replace(/\n/g, " ")}
                </a>
                <span className="font-mono text-[10px] text-white/20 shrink-0">
                  {time}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
