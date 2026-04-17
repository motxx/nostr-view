import { describe, it, expect } from "vitest";
import { parseNoteContent } from "./content-parser";

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

  it("keeps non-image URLs as text", () => {
    const input = "see https://example.com/page and https://x.com/pic.gif";
    const segments = parseNoteContent(input);
    expect(segments).toEqual([
      { type: "text", value: "see " },
      { type: "text", value: "https://example.com/page" },
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

  it("returns empty array for empty string", () => {
    expect(parseNoteContent("")).toEqual([]);
  });
});
