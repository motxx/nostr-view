import { describe, it, expect } from "vitest";
import { detectInteractionClusters } from "./interaction-cluster";
import type { NostrEvent } from "@/domain/entities/nostr-event";
import { NOSTR_KIND } from "@/lib/nostr-kinds";

function makeEvent(
  pubkey: string,
  kind: number,
  targets: string[],
): NostrEvent {
  return {
    id: "ev-" + Math.random().toString(36).slice(2, 8),
    pubkey,
    created_at: 1000,
    kind,
    tags: targets.map((t) => ["p", t]),
    content: "",
    sig: "sig",
  };
}

describe("detectInteractionClusters", () => {
  it("groups users who interact frequently", () => {
    // Group A: alice, bob, carol interact heavily
    // Group B: dave, eve, frank interact heavily
    const events = [
      makeEvent("alice", NOSTR_KIND.TEXT_NOTE, ["bob"]),
      makeEvent("bob", NOSTR_KIND.TEXT_NOTE, ["alice"]),
      makeEvent("carol", NOSTR_KIND.REACTION, ["alice"]),
      makeEvent("alice", NOSTR_KIND.REACTION, ["carol"]),
      makeEvent("bob", NOSTR_KIND.REACTION, ["carol"]),
      makeEvent("dave", NOSTR_KIND.TEXT_NOTE, ["eve"]),
      makeEvent("eve", NOSTR_KIND.TEXT_NOTE, ["dave"]),
      makeEvent("frank", NOSTR_KIND.REACTION, ["dave"]),
      makeEvent("dave", NOSTR_KIND.REACTION, ["frank"]),
      makeEvent("eve", NOSTR_KIND.REACTION, ["frank"]),
    ];
    const clusters = detectInteractionClusters(events, 3);
    expect(clusters.length).toBe(2);
    // Each cluster should have 3 members
    expect(clusters[0].memberPubkeys.size).toBe(3);
    expect(clusters[1].memberPubkeys.size).toBe(3);
  });

  it("returns empty for no events", () => {
    expect(detectInteractionClusters([])).toEqual([]);
  });
});
