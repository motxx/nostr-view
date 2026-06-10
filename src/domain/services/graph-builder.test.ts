import { describe, it, expect } from "vitest";
import { buildGraph } from "./graph-builder";
import type { NostrEvent } from "@/domain/entities/nostr-event";
import type { NostrProfile } from "@/domain/entities/nostr-profile";
import type { Cluster } from "@/domain/entities/cluster";
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

describe("buildGraph", () => {
  it("creates nodes from text note authors", () => {
    const events = [
      makeEvent({ pubkey: "alice", kind: NOSTR_KIND.TEXT_NOTE }),
      makeEvent({ pubkey: "bob", kind: NOSTR_KIND.TEXT_NOTE }),
    ];
    const { nodes } = buildGraph(events, new Map(), []);
    const ids = nodes.map((n) => n.id).sort();
    expect(ids).toEqual(["alice", "bob"]);
  });

  it("attaches profile name and picture to nodes", () => {
    const events = [
      makeEvent({ pubkey: "alice", kind: NOSTR_KIND.TEXT_NOTE }),
    ];
    const profiles = new Map<string, NostrProfile>([
      [
        "alice",
        {
          pubkey: "alice",
          name: "Alice",
          displayName: "Alice Wonder",
          picture: "https://example.com/alice.png",
          fetchedAt: Date.now(),
        },
      ],
    ]);
    const { nodes } = buildGraph(events, profiles, []);
    expect(nodes[0].name).toBe("Alice Wonder");
    expect(nodes[0].picture).toBe("https://example.com/alice.png");
  });

  it("builds reply edges between note authors (NIP-10 e-tag)", () => {
    const events = [
      makeEvent({ pubkey: "alice", kind: NOSTR_KIND.TEXT_NOTE }),
      makeEvent({ pubkey: "bob", kind: NOSTR_KIND.TEXT_NOTE, id: "bob-note" }),
      makeEvent({
        pubkey: "alice",
        kind: NOSTR_KIND.TEXT_NOTE,
        tags: [
          ["e", "bob-note", "", "reply"],
          ["p", "bob"],
        ],
      }),
    ];
    const { edges } = buildGraph(events, new Map(), []);
    const replies = edges.filter((e) => e.type === "reply");
    expect(replies).toHaveLength(1);
    expect(replies[0].source).toBe("alice");
    expect(replies[0].target).toBe("bob");
  });

  it("treats bare p-tags (no e-tag) as mention edges", () => {
    const events = [
      makeEvent({ pubkey: "alice", kind: NOSTR_KIND.TEXT_NOTE }),
      makeEvent({ pubkey: "bob", kind: NOSTR_KIND.TEXT_NOTE }),
      makeEvent({
        pubkey: "alice",
        kind: NOSTR_KIND.TEXT_NOTE,
        tags: [["p", "bob"]],
      }),
    ];
    const { edges } = buildGraph(events, new Map(), []);
    const mentions = edges.filter((e) => e.type === "mention");
    expect(mentions).toHaveLength(1);
    expect(mentions[0].target).toBe("bob");
  });

  it("builds reaction edges", () => {
    const events = [
      makeEvent({ pubkey: "alice", kind: NOSTR_KIND.TEXT_NOTE }),
      makeEvent({ pubkey: "bob", kind: NOSTR_KIND.TEXT_NOTE }),
      makeEvent({
        pubkey: "bob",
        kind: NOSTR_KIND.REACTION,
        tags: [["p", "alice"]],
      }),
    ];
    const { edges } = buildGraph(events, new Map(), []);
    const reactions = edges.filter((e) => e.type === "reaction");
    expect(reactions).toHaveLength(1);
    expect(reactions[0].source).toBe("bob");
    expect(reactions[0].target).toBe("alice");
  });

  it("assigns nodes to clusters", () => {
    const events = [
      makeEvent({ pubkey: "alice", kind: NOSTR_KIND.TEXT_NOTE }),
    ];
    const clusters: Cluster[] = [
      {
        id: "c1",
        label: "bitcoin",
        hashtags: ["bitcoin"],
        memberPubkeys: new Set(["alice"]),
        color: "#ff0000",
      },
    ];
    const { nodes } = buildGraph(events, new Map(), clusters);
    expect(nodes[0].clusterId).toBe("c1");
  });

  it("deduplicates edges", () => {
    const events = [
      makeEvent({ pubkey: "alice", kind: NOSTR_KIND.TEXT_NOTE }),
      makeEvent({ pubkey: "bob", kind: NOSTR_KIND.TEXT_NOTE }),
      makeEvent({
        pubkey: "alice",
        kind: NOSTR_KIND.TEXT_NOTE,
        tags: [["p", "bob"]],
      }),
      makeEvent({
        pubkey: "alice",
        kind: NOSTR_KIND.TEXT_NOTE,
        tags: [["p", "bob"]],
      }),
    ];
    const { edges } = buildGraph(events, new Map(), []);
    const mentions = edges.filter(
      (e) => e.type === "mention" && e.source === "alice" && e.target === "bob",
    );
    expect(mentions).toHaveLength(1);
  });

  it("builds zap edges between note authors (NIP-57)", () => {
    const sender = "f".repeat(64);
    const events = [
      makeEvent({ pubkey: sender, kind: NOSTR_KIND.TEXT_NOTE }),
      makeEvent({ pubkey: "alice", kind: NOSTR_KIND.TEXT_NOTE }),
      makeEvent({
        pubkey: "lnurl-server",
        kind: NOSTR_KIND.ZAP_RECEIPT,
        tags: [
          ["p", "alice"],
          ["P", sender],
        ],
      }),
    ];
    const { edges } = buildGraph(events, new Map(), []);
    const zaps = edges.filter((e) => e.type === "zap");
    expect(zaps).toHaveLength(1);
    expect(zaps[0].source).toBe(sender);
    expect(zaps[0].target).toBe("alice");
  });
});
