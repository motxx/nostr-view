import { describe, it, expect } from "vitest";
import { findRepresentativeNotes, computeBridges } from "./cluster-summary";
import type { Cluster } from "@/domain/entities/cluster";
import type { NostrEvent } from "@/domain/entities/nostr-event";
import { NOSTR_KIND } from "@/lib/nostr-kinds";

function makeNote(pubkey: string, content: string, id?: string): NostrEvent {
  return {
    id: id ?? "ev-" + Math.random().toString(36).slice(2, 8),
    pubkey,
    created_at: 1000,
    kind: NOSTR_KIND.TEXT_NOTE,
    tags: [],
    content,
    sig: "sig",
  };
}

function makeReaction(targetEventId: string): NostrEvent {
  return {
    id: "rx-" + Math.random().toString(36).slice(2, 8),
    pubkey: "reactor",
    created_at: 1000,
    kind: NOSTR_KIND.REACTION,
    tags: [["e", targetEventId]],
    content: "+",
    sig: "sig",
  };
}

describe("findRepresentativeNotes", () => {
  const cluster: Cluster = {
    id: "c1",
    label: "bitcoin",
    hashtags: ["bitcoin"],
    memberPubkeys: new Set(["alice", "bob"]),
    color: "#ff0000",
  };

  it("returns the most reacted-to notes from cluster members", () => {
    const note1 = makeNote("alice", "Bitcoin is great!", "n1");
    const note2 = makeNote("bob", "Lightning network rocks!", "n2");
    const note3 = makeNote("alice", "Another post here", "n3");
    const events = [
      note1,
      note2,
      note3,
      makeReaction("n2"),
      makeReaction("n2"),
      makeReaction("n2"),
      makeReaction("n1"),
    ];
    const reps = findRepresentativeNotes(cluster, events, 2);
    expect(reps).toHaveLength(2);
    expect(reps[0].id).toBe("n2"); // 3 reactions
    expect(reps[1].id).toBe("n1"); // 1 reaction
  });

  it("excludes short content", () => {
    const events = [makeNote("alice", "hi")]; // too short
    expect(findRepresentativeNotes(cluster, events)).toHaveLength(0);
  });
});

describe("computeBridges", () => {
  it("finds shared members between clusters", () => {
    const clusters: Cluster[] = [
      {
        id: "c1",
        label: "a",
        hashtags: [],
        memberPubkeys: new Set(["alice", "bob", "carol"]),
        color: "#f00",
      },
      {
        id: "c2",
        label: "b",
        hashtags: [],
        memberPubkeys: new Set(["bob", "carol", "dave"]),
        color: "#0f0",
      },
      {
        id: "c3",
        label: "c",
        hashtags: [],
        memberPubkeys: new Set(["eve"]),
        color: "#00f",
      },
    ];
    const bridges = computeBridges(clusters);
    expect(bridges.get("c1")?.get("c2")).toBe(2); // bob, carol
    expect(bridges.get("c1")?.has("c3")).toBe(false); // no shared
    expect(bridges.get("c2")?.get("c1")).toBe(2);
  });
});
