/** Segment types for parsed note content. */
export type ContentSegment =
  | { type: "text"; value: string }
  | { type: "link"; url: string }
  | { type: "image"; url: string }
  | { type: "video"; url: string }
  | { type: "youtube"; videoId: string }
  | { type: "hashtag"; tag: string };

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|avif|svg)(\?[^\s]*)?$/i;
const VIDEO_EXT = /\.(mp4|webm|mov|ogv|m4v)(\?[^\s]*)?$/i;
const URL_RE = /https?:\/\/[^\s)>\]]+/g;

const YOUTUBE_PATTERNS = [
  /(?:youtube\.com\/watch\?.*v=|youtu\.be\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})/,
];

/** Extract YouTube video ID from a URL, or null. */
export function extractYouTubeId(url: string): string | null {
  for (const re of YOUTUBE_PATTERNS) {
    const m = url.match(re);
    if (m) return m[1];
  }
  return null;
}

const HASHTAG_RE = /(?<!\S)#([\p{L}\p{N}_]+)/gu;

/** Split hashtags out of text segments. */
function splitHashtags(segments: ContentSegment[]): ContentSegment[] {
  const result: ContentSegment[] = [];
  for (const seg of segments) {
    if (seg.type !== "text") {
      result.push(seg);
      continue;
    }
    let lastIndex = 0;
    for (const m of seg.value.matchAll(HASHTAG_RE)) {
      const start = m.index;
      if (start > lastIndex) {
        result.push({ type: "text", value: seg.value.slice(lastIndex, start) });
      }
      result.push({ type: "hashtag", tag: m[1] });
      lastIndex = start + m[0].length;
    }
    if (lastIndex < seg.value.length) {
      result.push({ type: "text", value: seg.value.slice(lastIndex) });
    }
  }
  return result;
}

/** Split note content into text, media, and hashtag segments. */
export function parseNoteContent(content: string): ContentSegment[] {
  const segments: ContentSegment[] = [];
  let lastIndex = 0;

  for (const match of content.matchAll(URL_RE)) {
    const url = match[0];
    const start = match.index;

    if (start > lastIndex) {
      segments.push({ type: "text", value: content.slice(lastIndex, start) });
    }

    const ytId = extractYouTubeId(url);
    if (ytId) {
      segments.push({ type: "youtube", videoId: ytId });
    } else if (IMAGE_EXT.test(url)) {
      segments.push({ type: "image", url });
    } else if (VIDEO_EXT.test(url)) {
      segments.push({ type: "video", url });
    } else {
      segments.push({ type: "link", url });
    }

    lastIndex = start + url.length;
  }

  if (lastIndex < content.length) {
    segments.push({ type: "text", value: content.slice(lastIndex) });
  }

  return splitHashtags(segments);
}
