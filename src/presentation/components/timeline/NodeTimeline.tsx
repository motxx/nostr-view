"use client";

import { useMemo } from "react";
import { useEventStore } from "@/store/event-store";
import { NOSTR_KIND } from "@/lib/nostr-kinds";
import { primalProfileUrl } from "@/lib/nostr-url";
import { NoteCard } from "./NoteCard";

interface NodeTimelineProps {
  pubkey: string;
}

export function NodeTimeline({ pubkey }: NodeTimelineProps) {
  const eventsByAuthor = useEventStore((s) => s.eventsByAuthor);
  const profiles = useEventStore((s) => s.profiles);

  const profile = profiles.get(pubkey);
  const displayName =
    profile?.displayName || profile?.name || pubkey.slice(0, 12) + "...";

  const notes = useMemo(() => {
    const authorEvents = eventsByAuthor.get(pubkey);
    if (!authorEvents) return [];
    return [...authorEvents.values()]
      .filter((e) => e.kind === NOSTR_KIND.TEXT_NOTE)
      .sort((a, b) => b.created_at - a.created_at)
      .slice(0, 50);
  }, [pubkey, eventsByAuthor]);

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-3">
          {profile?.picture && (
            <img
              src={profile.picture}
              alt=""
              className="w-8 h-8 rounded-full object-cover border border-white/20"
            />
          )}
          <div className="min-w-0">
            <a
              href={primalProfileUrl(pubkey)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-sm text-white/80 font-medium truncate hover:text-blue-300 transition-colors block"
            >
              {displayName}
            </a>
            {profile?.nip05 && (
              <div className="font-mono text-xs text-white/40 truncate">
                {profile.nip05}
              </div>
            )}
          </div>
        </div>
        <p className="font-mono text-xs text-white/40 mt-1">
          {notes.length} notes
        </p>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {notes.map((event) => (
          <NoteCard key={event.id} event={event} profile={profile} />
        ))}
        {notes.length === 0 && (
          <p className="font-mono text-sm text-white/30 text-center py-8">
            No notes yet
          </p>
        )}
      </div>
    </div>
  );
}
