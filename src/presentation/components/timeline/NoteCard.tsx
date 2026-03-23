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
              <a
                href={primalNoteUrl(event.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs text-blue-400/60 hover:text-blue-400 transition-colors shrink-0 ml-auto"
                title="Open in Primal"
              >
                primal
              </a>
            </div>
            <a
              href={primalNoteUrl(event.id)}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <p className="text-sm text-white/60 hover:text-white/75 transition-colors break-words whitespace-pre-wrap leading-relaxed">
                {event.content.slice(0, maxLen)}
                {event.content.length > maxLen && "..."}
              </p>
            </a>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
