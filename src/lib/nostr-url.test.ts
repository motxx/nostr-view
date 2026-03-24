import { describe, it, expect } from "vitest";
import { primalNoteUrl, primalProfileUrl } from "./nostr-url";

const VALID_HEX_64 =
  "7e7e9c42a91bfef19890802f34f94082ae71185cecd2a0c3790795d0e8ed3e40";

describe("primalNoteUrl", () => {
  it("generates a valid Primal note URL with nevent encoding", () => {
    const url = primalNoteUrl(VALID_HEX_64);
    expect(url).toMatch(/^https:\/\/primal\.net\/e\/nevent1/);
  });

  it("produces different URLs for different event IDs", () => {
    const url1 = primalNoteUrl("a".repeat(64));
    const url2 = primalNoteUrl("b".repeat(64));
    expect(url1).not.toBe(url2);
  });
});

describe("primalProfileUrl", () => {
  it("generates a valid Primal profile URL with npub encoding", () => {
    const url = primalProfileUrl(VALID_HEX_64);
    expect(url).toMatch(/^https:\/\/primal\.net\/p\/npub1/);
  });

  it("produces consistent URLs for the same pubkey", () => {
    const url1 = primalProfileUrl(VALID_HEX_64);
    const url2 = primalProfileUrl(VALID_HEX_64);
    expect(url1).toBe(url2);
  });

  it("produces different URLs for different pubkeys", () => {
    const url1 = primalProfileUrl("a".repeat(64));
    const url2 = primalProfileUrl("b".repeat(64));
    expect(url1).not.toBe(url2);
  });
});
