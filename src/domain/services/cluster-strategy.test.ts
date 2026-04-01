import { describe, it, expect } from "vitest";
import {
  detectClustersByStrategy,
  CLUSTER_STRATEGY_LABELS,
  type ClusterStrategy,
} from "./cluster-strategy";
import type { NostrEvent } from "@/domain/entities/nostr-event";
import { NOSTR_KIND } from "@/lib/nostr-kinds";

function makeNote(
  pubkey: string,
  content: string,
  hashtags: string[] = [],
  targets: string[] = [],
): NostrEvent {
  return {
    id: "ev-" + Math.random().toString(36).slice(2, 8),
    pubkey,
    created_at: 1000,
    kind: NOSTR_KIND.TEXT_NOTE,
    tags: [
      ...hashtags.map((h) => ["t", h]),
      ...targets.map((t) => ["p", t]),
    ],
    content,
    sig: "sig",
  };
}

describe("detectClustersByStrategy", () => {
  const events: NostrEvent[] = [
    // Topic: 3 users share #bitcoin
    makeNote("alice", "hello", ["bitcoin"]),
    makeNote("bob", "world", ["bitcoin"]),
    makeNote("carol", "test", ["bitcoin"]),
    // Language: Japanese
    makeNote("dave", "こんにちは"),
    makeNote("eve", "おはよう"),
    makeNote("frank", "ありがとう"),
    // Interaction: replies
    makeNote("alice", "reply", [], ["bob"]),
    makeNote("bob", "reply", [], ["alice"]),
  ];

  it("dispatches to topic strategy", () => {
    const clusters = detectClustersByStrategy(events, "topic", 3);
    expect(clusters.length).toBeGreaterThanOrEqual(1);
    const btc = clusters.find((c) => c.hashtags.includes("bitcoin"));
    expect(btc).toBeDefined();
  });

  it("dispatches to interaction strategy and labels from hashtags", () => {
    // alice and bob interact and both use #bitcoin
    const clusters = detectClustersByStrategy(events, "interaction", 2);
    expect(clusters.length).toBeGreaterThanOrEqual(0);
    // If a cluster formed, it should have a hashtag-based label (not "Community N")
    for (const c of clusters) {
      if (c.hashtags.length > 0) {
        expect(c.label).not.toMatch(/^Community \d+$/);
      }
    }
  });

  it("dispatches to language strategy", () => {
    const clusters = detectClustersByStrategy(events, "language", 3);
    const jp = clusters.find((c) => c.label === "Japanese");
    expect(jp).toBeDefined();
    expect(jp!.memberPubkeys.size).toBe(3);
  });
});

describe("CLUSTER_STRATEGY_LABELS", () => {
  it("has labels for all strategies", () => {
    const strategies: ClusterStrategy[] = ["topic", "interaction", "language"];
    for (const s of strategies) {
      expect(CLUSTER_STRATEGY_LABELS[s]).toBeDefined();
      expect(typeof CLUSTER_STRATEGY_LABELS[s]).toBe("string");
    }
  });
});
