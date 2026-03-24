import { describe, it, expect } from "vitest";
import { detectLanguageClusters } from "./language-cluster";
import type { NostrEvent } from "@/domain/entities/nostr-event";
import { NOSTR_KIND } from "@/lib/nostr-kinds";

function makeNote(pubkey: string, content: string): NostrEvent {
  return {
    id: "ev-" + Math.random().toString(36).slice(2, 8),
    pubkey,
    created_at: 1000,
    kind: NOSTR_KIND.TEXT_NOTE,
    tags: [],
    content,
    sig: "sig",
  };
}

describe("detectLanguageClusters", () => {
  it("groups Japanese users together", () => {
    const events = [
      makeNote("alice", "こんにちは世界"),
      makeNote("bob", "おはようございます"),
      makeNote("carol", "ありがとう"),
      makeNote("dave", "Hello world"),
      makeNote("eve", "Good morning"),
      makeNote("frank", "Thanks everyone"),
    ];
    const clusters = detectLanguageClusters(events, 2);
    const jp = clusters.find((c) => c.label === "Japanese");
    const en = clusters.find((c) => c.label === "English");
    expect(jp).toBeDefined();
    expect(jp!.memberPubkeys.size).toBe(3);
    expect(en).toBeDefined();
    expect(en!.memberPubkeys.size).toBe(3);
  });

  it("returns empty for no events", () => {
    expect(detectLanguageClusters([])).toEqual([]);
  });
});
