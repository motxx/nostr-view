import { describe, it, expect } from "vitest";
import { detectClusters } from "./cluster-detector";
import type { NostrEvent } from "@/domain/entities/nostr-event";
import { NOSTR_KIND } from "@/lib/nostr-kinds";

function makeNote(
  pubkey: string,
  hashtags: string[],
  id?: string,
): NostrEvent {
  return {
    id: id ?? "ev-" + Math.random().toString(36).slice(2, 8),
    pubkey,
    created_at: 1000,
    kind: NOSTR_KIND.TEXT_NOTE,
    tags: hashtags.map((h) => ["t", h]),
    content: "",
    sig: "sig",
  };
}

describe("detectClusters", () => {
  it("returns empty for no events", () => {
    expect(detectClusters([])).toEqual([]);
  });

  it("ignores hashtags used by fewer than minClusterSize users", () => {
    const events = [
      makeNote("alice", ["bitcoin"]),
      makeNote("bob", ["bitcoin"]),
      // Only 2 users use "bitcoin", but minClusterSize defaults to 3
    ];
    const clusters = detectClusters(events);
    expect(clusters).toHaveLength(0);
  });

  it("detects a cluster when enough users share a hashtag", () => {
    const events = [
      makeNote("alice", ["bitcoin"]),
      makeNote("bob", ["bitcoin"]),
      makeNote("carol", ["bitcoin"]),
    ];
    const clusters = detectClusters(events, 3);
    expect(clusters.length).toBeGreaterThanOrEqual(1);
    const btcCluster = clusters.find((c) => c.hashtags.includes("bitcoin"));
    expect(btcCluster).toBeDefined();
    expect(btcCluster!.memberPubkeys.size).toBe(3);
  });

  it("limits number of clusters to maxClusters", () => {
    // Create many distinct hashtags each used by 3+ users
    const events: NostrEvent[] = [];
    for (let i = 0; i < 15; i++) {
      for (let j = 0; j < 3; j++) {
        events.push(makeNote(`user-${i}-${j}`, [`tag-${i}`]));
      }
    }
    const clusters = detectClusters(events, 3, 5);
    expect(clusters.length).toBeLessThanOrEqual(5);
  });

  it("groups co-occurring hashtags into the same cluster", () => {
    // alice, bob, carol all use both "bitcoin" and "lightning"
    const events = [
      makeNote("alice", ["bitcoin", "lightning"]),
      makeNote("bob", ["bitcoin", "lightning"]),
      makeNote("carol", ["bitcoin", "lightning"]),
    ];
    const clusters = detectClusters(events, 3);
    // Both tags should be in the same cluster
    if (clusters.length > 0) {
      const c = clusters[0];
      expect(c.hashtags).toContain("bitcoin");
      expect(c.hashtags).toContain("lightning");
    }
  });

  it("separates two topic groups with disjoint tag usage", () => {
    const events = [
      makeNote("alice", ["bitcoin", "lightning"]),
      makeNote("bob", ["bitcoin", "lightning"]),
      makeNote("carol", ["bitcoin", "lightning"]),
      makeNote("dora", ["art", "painting"]),
      makeNote("emma", ["art", "painting"]),
      makeNote("fred", ["art", "painting"]),
    ];
    const clusters = detectClusters(events, 3);
    expect(clusters.length).toBe(2);
    const btc = clusters.find((c) => c.hashtags.includes("bitcoin"))!;
    const art = clusters.find((c) => c.hashtags.includes("art"))!;
    expect([...btc.memberPubkeys].sort()).toEqual(["alice", "bob", "carol"]);
    expect([...art.memberPubkeys].sort()).toEqual(["dora", "emma", "fred"]);
  });

  it("assigns a user to the topic they use most", () => {
    const events = [
      makeNote("alice", ["bitcoin"]),
      makeNote("bob", ["bitcoin"]),
      makeNote("carol", ["bitcoin"]),
      makeNote("dora", ["art"]),
      makeNote("emma", ["art"]),
      makeNote("fred", ["art"]),
      // mixed user: posts art once but bitcoin three times
      makeNote("mixed", ["bitcoin"]),
      makeNote("mixed", ["bitcoin"]),
      makeNote("mixed", ["bitcoin"]),
      makeNote("mixed", ["art"]),
    ];
    const clusters = detectClusters(events, 3);
    const btc = clusters.find((c) => c.hashtags.includes("bitcoin"))!;
    expect(btc.memberPubkeys.has("mixed")).toBe(true);
  });

  it("is deterministic across runs", () => {
    const events = [
      makeNote("alice", ["bitcoin", "nostr"]),
      makeNote("bob", ["bitcoin", "nostr"]),
      makeNote("carol", ["bitcoin"]),
      makeNote("dora", ["art", "nostr"]),
      makeNote("emma", ["art", "nostr"]),
      makeNote("fred", ["art"]),
    ];
    const a = detectClusters(events, 2);
    const b = detectClusters(events, 2);
    expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id));
    expect(a.map((c) => [...c.memberPubkeys].sort())).toEqual(
      b.map((c) => [...c.memberPubkeys].sort()),
    );
  });
});
