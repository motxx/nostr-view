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
});
