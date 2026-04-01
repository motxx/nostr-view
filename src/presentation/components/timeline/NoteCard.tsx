"use client";

import { useState } from "react";
import type { NostrEvent } from "@/domain/entities/nostr-event";
import type { NostrProfile } from "@/domain/entities/nostr-profile";
import { primalNoteUrl } from "@/lib/nostr-url";

interface NoteCardProps {
  event: NostrEvent;
  profile?: NostrProfile;
  compact?: boolean;
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return date.toLocaleDateString();
}

function Avatar({ src, name }: { src?: string; name: string }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    const initial = name.charAt(0).toUpperCase() || "?";
    return (
      <div className="w-8 h-8 rounded bg-[#00ff41]/10 border border-[#00ff41]/15 shrink-0 flex items-center justify-center font-mono text-xs text-[#00ff41]/40">
        {initial}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt=""
      className="w-8 h-8 rounded object-cover border border-[#00ff41]/15 shrink-0"
      onError={() => setFailed(true)}
      loading="lazy"
    />
  );
}

export function NoteCard({ event, profile, compact }: NoteCardProps) {
  const displayName =
    profile?.displayName ||
    profile?.name ||
    event.pubkey.slice(0, 12) + "...";

  const maxLen = compact ? 200 : 500;

  return (
    <a
      href={primalNoteUrl(event.id)}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded bg-[#00ff41]/[0.02] border border-[#00ff41]/10 hover:bg-[#00ff41]/[0.06] hover:border-[#00ff41]/20 transition-colors p-3 cursor-pointer"
    >
      <div className="flex items-start gap-3">
        <Avatar src={profile?.picture} name={displayName} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-[11px] text-[#00ff41]/70 font-medium truncate">
              {displayName}
            </span>
            <span className="font-mono text-[10px] text-[#0ff]/25 shrink-0 tabular-nums">
              {formatTime(event.created_at)}
            </span>
          </div>
          <p className="text-[11px] font-mono text-[#00ff41]/45 break-words whitespace-pre-wrap leading-relaxed">
            {event.content.slice(0, maxLen)}
            {event.content.length > maxLen && "..."}
          </p>
        </div>
      </div>
    </a>
  );
}
