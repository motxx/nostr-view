"use client";

import { useMemo, useState } from "react";
import { parseNoteContent, type ContentSegment } from "@/lib/content-parser";

function InlineImage({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) return null;

  return (
    <img
      src={url}
      alt=""
      className="mt-1 mb-1 rounded border border-[#00ff41]/15 max-w-full max-h-48 object-contain"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

interface NoteContentProps {
  content: string;
  maxLen?: number;
  className?: string;
}

export function NoteContent({ content, maxLen, className }: NoteContentProps) {
  const truncated = maxLen ? content.slice(0, maxLen) : content;
  const isTruncated = maxLen != null && content.length > maxLen;

  const segments = useMemo(
    () => parseNoteContent(truncated),
    [truncated],
  );

  return (
    <div className={className}>
      {segments.map((seg, i) =>
        seg.type === "image" ? (
          <InlineImage key={i} url={seg.url} />
        ) : (
          <span key={i} className="whitespace-pre-wrap">
            {seg.value}
          </span>
        ),
      )}
      {isTruncated && <span>...</span>}
    </div>
  );
}
