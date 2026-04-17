"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Markdown from "react-markdown";
import { parseNoteContent, type ContentSegment } from "@/lib/content-parser";

function InlineImage({ url, grid }: { url: string; grid?: boolean }) {
  const [failed, setFailed] = useState(false);

  if (failed) return null;

  return (
    <img
      src={url}
      alt=""
      className={
        grid
          ? "rounded border border-[#00ff41]/15 w-full h-full object-cover"
          : "mt-1 mb-1 rounded border border-[#00ff41]/15 max-w-full max-h-48 object-contain"
      }
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

function ImageGrid({ urls }: { urls: string[] }) {
  if (urls.length === 1) {
    return <InlineImage url={urls[0]} />;
  }
  const cols = urls.length <= 2 ? "grid-cols-2" : "grid-cols-3";
  return (
    <div className={`grid ${cols} gap-1 mt-1 mb-1 max-h-64 overflow-hidden rounded border border-[#00ff41]/15`}>
      {urls.map((url) => (
        <div key={url} className="aspect-square overflow-hidden">
          <InlineImage url={url} grid />
        </div>
      ))}
    </div>
  );
}

function YouTubeEmbed({ videoId }: { videoId: string }) {
  const ref = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        const win = el.contentWindow;
        if (!win) return;
        const cmd = entry.isIntersecting ? "playVideo" : "pauseVideo";
        win.postMessage(
          JSON.stringify({ event: "command", func: cmd, args: [] }),
          "*",
        );
      },
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <iframe
      ref={ref}
      src={`https://www.youtube.com/embed/${videoId}?enablejsapi=1&mute=1`}
      title="YouTube"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
      className="mt-1 mb-1 rounded border border-[#00ff41]/15 w-full aspect-video max-h-48"
      loading="lazy"
    />
  );
}

function InlineVideo({ url }: { url: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.play().catch(() => {});
        } else {
          el.pause();
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (failed) return null;

  return (
    <video
      ref={ref}
      src={url}
      controls
      muted
      preload="metadata"
      className="mt-1 mb-1 rounded border border-[#00ff41]/15 max-w-full max-h-48"
      onError={() => setFailed(true)}
    />
  );
}

function isSafeHref(href: string | undefined): boolean {
  if (!href) return false;
  return href.startsWith("http://") || href.startsWith("https://") || href.startsWith("/");
}

const markdownComponents = {
  p: ({ children }: { children?: React.ReactNode }) => <span className="whitespace-pre-wrap">{children}</span>,
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) =>
    isSafeHref(href) ? (
      <a href={href} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-[#0ff]/60 hover:text-[#0ff] underline underline-offset-2">
        {children}
      </a>
    ) : (
      <span>{children}</span>
    ),
  strong: ({ children }: { children?: React.ReactNode }) => <strong className="text-[#00ff41]/80 font-bold">{children}</strong>,
  em: ({ children }: { children?: React.ReactNode }) => <em className="text-[#00ff41]/70 italic">{children}</em>,
  code: ({ children }: { children?: React.ReactNode }) => <code className="bg-[#00ff41]/10 text-[#0ff]/70 px-1 rounded text-[0.9em]">{children}</code>,
  pre: ({ children }: { children?: React.ReactNode }) => <pre className="bg-[#00ff41]/5 border border-[#00ff41]/10 rounded p-2 my-1 overflow-x-auto text-[0.9em]">{children}</pre>,
  ul: ({ children }: { children?: React.ReactNode }) => <ul className="list-disc list-inside my-0.5">{children}</ul>,
  ol: ({ children }: { children?: React.ReactNode }) => <ol className="list-decimal list-inside my-0.5">{children}</ol>,
  blockquote: ({ children }: { children?: React.ReactNode }) => <blockquote className="border-l-2 border-[#00ff41]/30 pl-2 my-0.5 text-[#00ff41]/50 italic">{children}</blockquote>,
  h1: ({ children }: { children?: React.ReactNode }) => <span className="font-bold text-[#00ff41]/90 text-[1.1em]">{children}</span>,
  h2: ({ children }: { children?: React.ReactNode }) => <span className="font-bold text-[#00ff41]/85 text-[1.05em]">{children}</span>,
  h3: ({ children }: { children?: React.ReactNode }) => <span className="font-bold text-[#00ff41]/80">{children}</span>,
  img: () => null,
};

interface NoteContentProps {
  content: string;
  maxLen?: number;
  className?: string;
  onHashtagClick?: (tag: string) => void;
}

export function NoteContent({ content, maxLen, className, onHashtagClick }: NoteContentProps) {
  // Parse full content first, then truncate at segment boundaries
  // so media URLs are never cut in half.
  const { segments, isTruncated } = useMemo(() => {
    const all = parseNoteContent(content);
    if (maxLen == null) return { segments: all, isTruncated: false };

    const result: ContentSegment[] = [];
    let textUsed = 0;
    for (const seg of all) {
      if (seg.type === "text") {
        const remaining = maxLen - textUsed;
        if (remaining <= 0) break;
        if (seg.value.length <= remaining) {
          result.push(seg);
          textUsed += seg.value.length;
        } else {
          result.push({ type: "text", value: seg.value.slice(0, remaining) });
          textUsed += remaining;
          break;
        }
      } else if (seg.type === "hashtag") {
        const tagLen = seg.tag.length + 1; // #tag
        if (textUsed + tagLen > maxLen) break;
        result.push(seg);
        textUsed += tagLen;
      } else if (seg.type === "link") {
        // Links count toward text budget
        if (textUsed + seg.url.length > maxLen) break;
        result.push(seg);
        textUsed += seg.url.length;
      } else {
        // Media segments (image, video, youtube) don't consume text budget
        result.push(seg);
      }
    }
    const totalText = all.reduce((n, s) => {
      if (s.type === "text") return n + s.value.length;
      if (s.type === "hashtag") return n + s.tag.length + 1;
      if (s.type === "link") return n + s.url.length;
      return n;
    }, 0);
    return { segments: result, isTruncated: totalText > maxLen };
  }, [content, maxLen]);

  // Group consecutive image segments for grid display
  const grouped = useMemo(() => {
    const result: (Exclude<ContentSegment, { type: "image" }> | { type: "image-group"; urls: string[] })[] = [];
    let imageBuffer: string[] = [];

    const flushImages = () => {
      if (imageBuffer.length > 0) {
        result.push({ type: "image-group", urls: [...imageBuffer] });
        imageBuffer = [];
      }
    };

    for (const seg of segments) {
      if (seg.type === "image") {
        imageBuffer.push(seg.url);
      } else {
        flushImages();
        result.push(seg);
      }
    }
    flushImages();
    return result;
  }, [segments]);

  return (
    <div className={className}>
      {grouped.map((seg, i) =>
        seg.type === "image-group" ? (
          <ImageGrid key={i} urls={seg.urls} />
        ) : seg.type === "video" ? (
          <InlineVideo key={i} url={seg.url} />
        ) : seg.type === "youtube" ? (
          <YouTubeEmbed key={i} videoId={seg.videoId} />
        ) : seg.type === "link" ? (
          <a
            key={i}
            href={seg.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-[#0ff]/60 hover:text-[#0ff] underline underline-offset-2 transition-colors break-all"
          >
            {seg.url}
          </a>
        ) : seg.type === "hashtag" ? (
          <button
            key={i}
            type="button"
            onClick={onHashtagClick ? (e) => { e.preventDefault(); e.stopPropagation(); onHashtagClick(seg.tag); } : undefined}
            className="text-[#0ff]/60 hover:text-[#0ff] transition-colors cursor-pointer"
          >
            #{seg.tag}
          </button>
        ) : (
          <Markdown key={i} components={markdownComponents}>
            {seg.value}
          </Markdown>
        ),
      )}
      {isTruncated && <span>...</span>}
    </div>
  );
}
