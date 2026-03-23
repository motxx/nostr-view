import { describe, it, expect } from "vitest";
import {
  calculateInfluenceScores,
  getMetricsForPubkey,
} from "./influence-calculator";
import type { NostrEvent } from "@/domain/entities/nostr-event";
import { NOSTR_KIND } from "@/lib/nostr-kinds";

function makeEvent(overrides: Partial<NostrEvent>): NostrEvent {
  return {
    id: "ev-" + Math.random().toString(36).slice(2, 8),
    pubkey: "pk-author",
    created_at: 1000,
    kind: 1,
    tags: [],
    content: "",
    sig: "sig",
    ...overrides,
  };
}

describe("calculateInfluenceScores", () => {
  it("scores text notes as 0.1 per note", () => {
    const events = [
      makeEvent({ pubkey: "alice", kind: NOSTR_KIND.TEXT_NOTE }),
      makeEvent({ pubkey: "alice", kind: NOSTR_KIND.TEXT_NOTE }),
    ];
    const scores = calculateInfluenceScores(events);
    expect(scores["alice"]).toBeCloseTo(0.2);
  });

  it("scores followers as 1.0 per follow", () => {
    const events = [
      makeEvent({
        pubkey: "bob",
        kind: NOSTR_KIND.CONTACT_LIST,
        tags: [
          ["p", "alice"],
          ["p", "carol"],
        ],
      }),
    ];
    const scores = calculateInfluenceScores(events);
    expect(scores["alice"]).toBeCloseTo(1.0);
    expect(scores["carol"]).toBeCloseTo(1.0);
  });

  it("scores reactions as 0.5", () => {
    const events = [
      makeEvent({
        pubkey: "bob",
        kind: NOSTR_KIND.REACTION,
        tags: [["p", "alice"]],
      }),
    ];
    const scores = calculateInfluenceScores(events);
    expect(scores["alice"]).toBeCloseTo(0.5);
  });

  it("scores reposts as 2.0", () => {
    const events = [
      makeEvent({
        pubkey: "bob",
        kind: NOSTR_KIND.REPOST,
        tags: [["p", "alice"]],
      }),
    ];
    const scores = calculateInfluenceScores(events);
    expect(scores["alice"]).toBeCloseTo(2.0);
  });

  it("combines all score types", () => {
    const events = [
      // alice posts 1 note (0.1)
      makeEvent({ pubkey: "alice", kind: NOSTR_KIND.TEXT_NOTE }),
      // bob follows alice (1.0)
      makeEvent({
        pubkey: "bob",
        kind: NOSTR_KIND.CONTACT_LIST,
        tags: [["p", "alice"]],
      }),
      // carol reacts to alice (0.5)
      makeEvent({
        pubkey: "carol",
        kind: NOSTR_KIND.REACTION,
        tags: [["p", "alice"]],
      }),
      // dave reposts alice (2.0)
      makeEvent({
        pubkey: "dave",
        kind: NOSTR_KIND.REPOST,
        tags: [["p", "alice"]],
      }),
    ];
    const scores = calculateInfluenceScores(events);
    // 0.1 + 1.0 + 0.5 + 2.0 = 3.6
    expect(scores["alice"]).toBeCloseTo(3.6);
  });

  it("returns empty for no events", () => {
    expect(calculateInfluenceScores([])).toEqual({});
  });
});

describe("getMetricsForPubkey", () => {
  it("counts all metric types for a specific pubkey", () => {
    const events = [
      makeEvent({ pubkey: "alice", kind: NOSTR_KIND.TEXT_NOTE }),
      makeEvent({ pubkey: "alice", kind: NOSTR_KIND.TEXT_NOTE }),
      makeEvent({
        pubkey: "bob",
        kind: NOSTR_KIND.CONTACT_LIST,
        tags: [["p", "alice"]],
      }),
      makeEvent({
        pubkey: "carol",
        kind: NOSTR_KIND.REACTION,
        tags: [["p", "alice"]],
      }),
      makeEvent({
        pubkey: "dave",
        kind: NOSTR_KIND.REPOST,
        tags: [["p", "alice"]],
      }),
      // Event not related to alice
      makeEvent({ pubkey: "bob", kind: NOSTR_KIND.TEXT_NOTE }),
    ];

    const m = getMetricsForPubkey("alice", events);
    expect(m.noteCount).toBe(2);
    expect(m.followerCount).toBe(1);
    expect(m.reactionCount).toBe(1);
    expect(m.repostCount).toBe(1);
  });

  it("returns zeros for unknown pubkey", () => {
    const m = getMetricsForPubkey("unknown", []);
    expect(m).toEqual({
      followerCount: 0,
      reactionCount: 0,
      repostCount: 0,
      noteCount: 0,
    });
  });
});
