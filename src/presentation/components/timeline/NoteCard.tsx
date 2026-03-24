"use client";

import { useState } from "react";
import type { NostrEvent } from "@/domain/entities/nostr-event";
import type { NostrProfile } from "@/domain/entities/nostr-profile";
import { Card, CardContent } from "@/components/ui/card";
import { primalNoteUrl, primalProfileUrl } from "@/lib/nostr-url";

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
      <div className="w-8 h-8 rounded-full bg-white/10 border border-white/20 shrink-0 flex items-center justify-center font-mono text-xs text-white/50">
        {initial}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt=""
      className="w-8 h-8 rounded-full object-cover border border-white/20 shrink-0"
      onError={() => setFailed(true)}
      loading="lazy"
    />
  );
}

function ExternalLinkIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0">
      <path d="M9 6.5V9.5C9 10.05 8.55 10.5 8 10.5H2.5C1.95 10.5 1.5 10.05 1.5 9.5V4C1.5 3.45 1.95 3 2.5 3H5.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M7.5 1.5H10.5V4.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M5 7L10.5 1.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function NoteCard({ event, profile, compact }: NoteCardProps) {
  const displayName =
    profile?.displayName ||
    profile?.name ||
    event.pubkey.slice(0, 12) + "...";

  const maxLen = compact ? 200 : 500;

  return (
    <Card className="bg-white/5 border-white/10 hover:bg-white/[0.08] transition-colors">
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          <a
            href={primalProfileUrl(event.pubkey)}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0"
          >
            <Avatar src={profile?.picture} name={displayName} />
          </a>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <a
                href={primalProfileUrl(event.pubkey)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-sm text-white/80 font-medium truncate hover:text-white transition-colors"
              >
                {displayName}
              </a>
              <span className="font-mono text-xs text-white/30 shrink-0">
                {formatTime(event.created_at)}
              </span>
            </div>
            <p className="text-sm text-white/60 break-words whitespace-pre-wrap leading-relaxed mb-2">
              {event.content.slice(0, maxLen)}
              {event.content.length > maxLen && "..."}
            </p>
            <a
              href={primalNoteUrl(event.id)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-500/15 border border-purple-400/30 font-mono text-xs text-purple-300 hover:bg-purple-500/25 hover:text-purple-200 transition-colors"
            >
              Open in Primal
              <ExternalLinkIcon />
            </a>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
