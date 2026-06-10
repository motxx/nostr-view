import { describe, it, expect } from "vitest";
import { detectInteractionClusters } from "./interaction-cluster";
import type { NostrEvent } from "@/domain/entities/nostr-event";
import { NOSTR_KIND } from "@/lib/nostr-kinds";

function makeEvent(
  pubkey: string,
  kind: number,
  targets: string[],
  hashtags: string[] = [],
): NostrEvent {
  return {
    id: "ev-" + Math.random().toString(36).slice(2, 8),
    pubkey,
    created_at: 1000,
    kind,
    tags: [
      ...targets.map((t) => ["p", t]),
      ...hashtags.map((h) => ["t", h]),
    ],
    content: "",
    sig: "sig",
  };
}

describe("detectInteractionClusters", () => {
  it("groups users who interact frequently", () => {
    // Group A: alice, bob, carol interact heavily
    // Group B: dave, eve, frank interact heavily
    // All six author notes (only note authors are clustered/visualized)
    const events = [
      makeEvent("alice", NOSTR_KIND.TEXT_NOTE, ["bob"]),
      makeEvent("bob", NOSTR_KIND.TEXT_NOTE, ["alice"]),
      makeEvent("carol", NOSTR_KIND.TEXT_NOTE, ["alice"]),
      makeEvent("alice", NOSTR_KIND.REACTION, ["carol"]),
      makeEvent("bob", NOSTR_KIND.REACTION, ["carol"]),
      makeEvent("dave", NOSTR_KIND.TEXT_NOTE, ["eve"]),
      makeEvent("eve", NOSTR_KIND.TEXT_NOTE, ["dave"]),
      makeEvent("frank", NOSTR_KIND.TEXT_NOTE, ["dave"]),
      makeEvent("dave", NOSTR_KIND.REACTION, ["frank"]),
      makeEvent("eve", NOSTR_KIND.REACTION, ["frank"]),
    ];
    const clusters = detectInteractionClusters(events, 3);
    expect(clusters.length).toBe(2);
    // Each cluster should have 3 members
    expect(clusters[0].memberPubkeys.size).toBe(3);
    expect(clusters[1].memberPubkeys.size).toBe(3);
  });

  it("only clusters note authors (reaction-only users are not visualized)", () => {
    const events = [
      makeEvent("alice", NOSTR_KIND.TEXT_NOTE, ["bob"]),
      makeEvent("bob", NOSTR_KIND.TEXT_NOTE, ["alice"]),
      makeEvent("carol", NOSTR_KIND.TEXT_NOTE, ["alice"]),
      // ghost never posts a note — must not appear in any cluster
      makeEvent("ghost", NOSTR_KIND.REACTION, ["alice"]),
      makeEvent("ghost", NOSTR_KIND.REACTION, ["bob"]),
    ];
    const clusters = detectInteractionClusters(events, 3);
    expect(clusters.length).toBe(1);
    expect(clusters[0].memberPubkeys.has("ghost")).toBe(false);
  });

  it("labels clusters from member hashtags", () => {
    const events = [
      makeEvent("alice", NOSTR_KIND.TEXT_NOTE, ["bob"], ["bitcoin"]),
      makeEvent("bob", NOSTR_KIND.TEXT_NOTE, ["alice"], ["bitcoin", "nostr"]),
      makeEvent("carol", NOSTR_KIND.TEXT_NOTE, ["alice"], ["bitcoin"]),
    ];
    const clusters = detectInteractionClusters(events, 3);
    expect(clusters.length).toBe(1);
    expect(clusters[0].label).toBe("bitcoin, nostr");
    expect(clusters[0].hashtags).toContain("bitcoin");
    expect(clusters[0].hashtags).toContain("nostr");
  });

  it("falls back to Community N when no hashtags", () => {
    const events = [
      makeEvent("alice", NOSTR_KIND.TEXT_NOTE, ["bob"]),
      makeEvent("bob", NOSTR_KIND.TEXT_NOTE, ["alice"]),
      makeEvent("carol", NOSTR_KIND.TEXT_NOTE, ["alice"]),
      makeEvent("alice", NOSTR_KIND.REACTION, ["carol"]),
      makeEvent("bob", NOSTR_KIND.REACTION, ["carol"]),
    ];
    const clusters = detectInteractionClusters(events, 3);
    expect(clusters.length).toBe(1);
    expect(clusters[0].label).toBe("Community 1");
    expect(clusters[0].hashtags).toEqual([]);
  });

  it("returns empty for no events", () => {
    expect(detectInteractionClusters([])).toEqual([]);
  });

  it("is deterministic across runs (label propagation was not)", () => {
    const events = [
      makeEvent("alice", NOSTR_KIND.TEXT_NOTE, ["bob"]),
      makeEvent("bob", NOSTR_KIND.REACTION, ["carol"]),
      makeEvent("carol", NOSTR_KIND.REPOST, ["alice"]),
      makeEvent("dave", NOSTR_KIND.TEXT_NOTE, ["eve"]),
      makeEvent("eve", NOSTR_KIND.REACTION, ["frank"]),
      makeEvent("frank", NOSTR_KIND.CONTACT_LIST, ["dave"]),
      makeEvent("alice", NOSTR_KIND.REACTION, ["dave"]),
    ];
    const a = detectInteractionClusters(events, 2);
    const b = detectInteractionClusters(events, 2);
    expect(a.map((c) => [...c.memberPubkeys].sort())).toEqual(
      b.map((c) => [...c.memberPubkeys].sort()),
    );
  });

  it("does not merge two dense groups joined by one weak link", () => {
    // Louvain separates these; label propagation often collapsed them
    const groupA = ["a1", "a2", "a3", "a4"];
    const groupB = ["b1", "b2", "b3", "b4"];
    const events: NostrEvent[] = [];
    for (const x of groupA) {
      for (const y of groupA) {
        if (x !== y) events.push(makeEvent(x, NOSTR_KIND.TEXT_NOTE, [y]));
      }
    }
    for (const x of groupB) {
      for (const y of groupB) {
        if (x !== y) events.push(makeEvent(x, NOSTR_KIND.TEXT_NOTE, [y]));
      }
    }
    events.push(makeEvent("a1", NOSTR_KIND.REACTION, ["b1"]));

    const clusters = detectInteractionClusters(events, 3);
    expect(clusters.length).toBe(2);
    const members0 = [...clusters[0].memberPubkeys].sort();
    const members1 = [...clusters[1].memberPubkeys].sort();
    expect([members0, members1].sort()).toEqual([groupA, groupB].sort());
  });
});
