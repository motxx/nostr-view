/** Segment types for parsed note content. */
export type ContentSegment =
  | { type: "text"; value: string }
  | { type: "image"; url: string };

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|avif|svg)(\?[^\s]*)?$/i;
const URL_RE = /https?:\/\/[^\s)>\]]+/g;

/** Split note content into text and image-URL segments. */
export function parseNoteContent(content: string): ContentSegment[] {
  const segments: ContentSegment[] = [];
  let lastIndex = 0;

  for (const match of content.matchAll(URL_RE)) {
    const url = match[0];
    const start = match.index;

    if (start > lastIndex) {
      segments.push({ type: "text", value: content.slice(lastIndex, start) });
    }

    if (IMAGE_EXT.test(url)) {
      segments.push({ type: "image", url });
    } else {
      segments.push({ type: "text", value: url });
    }

    lastIndex = start + url.length;
  }

  if (lastIndex < content.length) {
    segments.push({ type: "text", value: content.slice(lastIndex) });
  }

  return segments;
}
