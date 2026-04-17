import { describe, it, expect } from "vitest";
import { parseNoteContent, extractYouTubeId } from "./content-parser";

describe("parseNoteContent", () => {
  it("returns plain text as a single text segment", () => {
    expect(parseNoteContent("hello world")).toEqual([
      { type: "text", value: "hello world" },
    ]);
  });

  it("extracts image URLs with common extensions", () => {
    const input = "check this https://example.com/photo.jpg cool";
    const segments = parseNoteContent(input);
    expect(segments).toEqual([
      { type: "text", value: "check this " },
      { type: "image", url: "https://example.com/photo.jpg" },
      { type: "text", value: " cool" },
    ]);
  });

  it("handles multiple images", () => {
    const input =
      "https://a.com/1.png text https://b.com/2.webp";
    const segments = parseNoteContent(input);
    expect(segments).toEqual([
      { type: "image", url: "https://a.com/1.png" },
      { type: "text", value: " text " },
      { type: "image", url: "https://b.com/2.webp" },
    ]);
  });

  it("makes non-media URLs clickable links", () => {
    const input = "see https://example.com/page and https://x.com/pic.gif";
    const segments = parseNoteContent(input);
    expect(segments).toEqual([
      { type: "text", value: "see " },
      { type: "link", url: "https://example.com/page" },
      { type: "text", value: " and " },
      { type: "image", url: "https://x.com/pic.gif" },
    ]);
  });

  it("handles image URLs with query strings", () => {
    const input = "https://cdn.example.com/img.jpeg?width=400&q=80";
    const segments = parseNoteContent(input);
    expect(segments).toEqual([
      { type: "image", url: "https://cdn.example.com/img.jpeg?width=400&q=80" },
    ]);
  });

  it("extracts video URLs with common extensions", () => {
    const input = "watch https://cdn.example.com/clip.mp4 here";
    expect(parseNoteContent(input)).toEqual([
      { type: "text", value: "watch " },
      { type: "video", url: "https://cdn.example.com/clip.mp4" },
      { type: "text", value: " here" },
    ]);
  });

  it("handles video URLs with query strings", () => {
    const input = "https://v.nostr.build/video.webm?t=10";
    expect(parseNoteContent(input)).toEqual([
      { type: "video", url: "https://v.nostr.build/video.webm?t=10" },
    ]);
  });

  it("handles mixed image and video URLs", () => {
    const input = "https://a.com/pic.png https://b.com/vid.mov";
    expect(parseNoteContent(input)).toEqual([
      { type: "image", url: "https://a.com/pic.png" },
      { type: "text", value: " " },
      { type: "video", url: "https://b.com/vid.mov" },
    ]);
  });

  it("extracts YouTube watch URLs", () => {
    const input = "check https://www.youtube.com/watch?v=dQw4w9WgXcQ out";
    expect(parseNoteContent(input)).toEqual([
      { type: "text", value: "check " },
      { type: "youtube", videoId: "dQw4w9WgXcQ" },
      { type: "text", value: " out" },
    ]);
  });

  it("extracts youtu.be short URLs", () => {
    const input = "https://youtu.be/dQw4w9WgXcQ";
    expect(parseNoteContent(input)).toEqual([
      { type: "youtube", videoId: "dQw4w9WgXcQ" },
    ]);
  });

  it("extracts YouTube Shorts URLs", () => {
    const input = "https://youtube.com/shorts/abcDEF12345";
    expect(parseNoteContent(input)).toEqual([
      { type: "youtube", videoId: "abcDEF12345" },
    ]);
  });

  it("extracts hashtags from text", () => {
    const input = "hello #bitcoin and #nostr";
    expect(parseNoteContent(input)).toEqual([
      { type: "text", value: "hello " },
      { type: "hashtag", tag: "bitcoin" },
      { type: "text", value: " and " },
      { type: "hashtag", tag: "nostr" },
    ]);
  });

  it("extracts hashtag at start of text", () => {
    expect(parseNoteContent("#zap")).toEqual([
      { type: "hashtag", tag: "zap" },
    ]);
  });

  it("does not match mid-word hash", () => {
    expect(parseNoteContent("foo#bar")).toEqual([
      { type: "text", value: "foo#bar" },
    ]);
  });

  it("handles Japanese hashtags", () => {
    const input = "hello #ビットコイン";
    expect(parseNoteContent(input)).toEqual([
      { type: "text", value: "hello " },
      { type: "hashtag", tag: "ビットコイン" },
    ]);
  });

  it("handles mixed media and hashtags", () => {
    const input = "pic https://a.com/x.png #art";
    expect(parseNoteContent(input)).toEqual([
      { type: "text", value: "pic " },
      { type: "image", url: "https://a.com/x.png" },
      { type: "text", value: " " },
      { type: "hashtag", tag: "art" },
    ]);
  });

  it("returns empty array for empty string", () => {
    expect(parseNoteContent("")).toEqual([]);
  });
});

describe("extractYouTubeId", () => {
  it("extracts from standard watch URL", () => {
    expect(extractYouTubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("extracts from youtu.be", () => {
    expect(extractYouTubeId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("extracts from shorts", () => {
    expect(extractYouTubeId("https://youtube.com/shorts/abcDEF12345")).toBe("abcDEF12345");
  });

  it("extracts with extra query params", () => {
    expect(extractYouTubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42")).toBe("dQw4w9WgXcQ");
  });

  it("returns null for non-YouTube URL", () => {
    expect(extractYouTubeId("https://example.com/page")).toBeNull();
  });
});
