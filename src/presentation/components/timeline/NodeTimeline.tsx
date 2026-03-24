"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useEventStore } from "@/store/event-store";
import { NOSTR_KIND } from "@/lib/nostr-kinds";
import { primalProfileUrl } from "@/lib/nostr-url";
import { fetchUserActivity, fetchProfiles } from "@/infra/nostr/event-fetcher";
import { NoteCard } from "./NoteCard";

interface NodeTimelineProps {
  pubkey: string;
}

export function NodeTimeline({ pubkey }: NodeTimelineProps) {
  const eventsById = useEventStore((s) => s.eventsById);
  const profiles = useEventStore((s) => s.profiles);

  // Fetch this user's full activity on demand
  const { isFetching } = useQuery({
    queryKey: ["nostr", "user-activity", pubkey],
    queryFn: async () => {
      const events = await fetchUserActivity(pubkey);
      useEventStore.getState().addEvents(events);

      // Also fetch profiles for reply/mention authors
      const unknownPubkeys = events
        .map((e) => e.pubkey)
        .filter((pk) => !useEventStore.getState().profiles.has(pk));
      const unique = [...new Set(unknownPubkeys)].slice(0, 50);
      if (unique.length > 0) {
        const profileEvents = await fetchProfiles(unique);
        useEventStore.getState().addEvents(profileEvents);
      }

      return events.length;
    },
    staleTime: 60_000,
  });

  const profile = profiles.get(pubkey);
  const displayName =
    profile?.displayName || profile?.name || pubkey.slice(0, 12) + "...";

  // Combine: own notes + text notes that mention this user
  const notes = useMemo(() => {
    const result: typeof eventsById extends Map<string, infer V> ? V[] : never[] = [];
    for (const ev of eventsById.values()) {
      if (ev.kind !== NOSTR_KIND.TEXT_NOTE) continue;
      // Own notes
      if (ev.pubkey === pubkey) {
        result.push(ev);
        continue;
      }
      // Replies mentioning this user
      if (ev.tags.some((t) => t[0] === "p" && t[1] === pubkey)) {
        result.push(ev);
      }
    }
    result.sort((a, b) => b.created_at - a.created_at);
    return result.slice(0, 100);
  }, [pubkey, eventsById]);

  const ownCount = notes.filter((n) => n.pubkey === pubkey).length;
  const replyCount = notes.length - ownCount;

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
          {isFetching
            ? "Loading..."
            : `${ownCount} notes, ${replyCount} replies`}
        </p>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {notes.map((event) => (
          <NoteCard
            key={event.id}
            event={event}
            profile={profiles.get(event.pubkey)}
          />
        ))}
        {notes.length === 0 && !isFetching && (
          <p className="font-mono text-sm text-white/30 text-center py-8">
            No notes yet
          </p>
        )}
      </div>
    </div>
  );
}
