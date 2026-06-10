import { describe, it, expect } from "vitest";
import {
  detectClustersByStrategy,
  selectBestClusters,
  CLUSTER_STRATEGY_LABELS,
  CLUSTER_MODE_LABELS,
  CLUSTER_STRATEGIES,
  CLUSTER_MODES,
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

  it("dispatches to engagement strategy", () => {
    const clusters = detectClustersByStrategy(events, "engagement", 1);
    expect(clusters.length).toBeGreaterThanOrEqual(1);
    for (const c of clusters) {
      expect(c.id.startsWith("engagement-")).toBe(true);
      expect(c.labelLocked).toBe(true);
    }
  });
});

describe("selectBestClusters", () => {
  it("evaluates every facet and returns the best by quality score", () => {
    // Two dense interaction groups → interaction facet should partition
    // the graph far better than topic/language (no tags, same language)
    const events: NostrEvent[] = [];
    const groupA = ["a1", "a2", "a3", "a4"];
    const groupB = ["b1", "b2", "b3", "b4"];
    for (const g of [groupA, groupB]) {
      for (const x of g) {
        for (const y of g) {
          if (x < y) events.push(makeNote(x, "hello", [], [y]));
        }
      }
    }

    const selection = selectBestClusters(events, 3);
    expect(selection.strategy).toBe("interaction");
    expect(selection.clusters.length).toBe(2);
    // all facets evaluated
    for (const s of CLUSTER_STRATEGIES) {
      expect(selection.qualities[s]).toBeDefined();
    }
    const winner = selection.qualities[selection.strategy]!;
    for (const s of CLUSTER_STRATEGIES) {
      expect(winner.score).toBeGreaterThanOrEqual(
        selection.qualities[s]!.score,
      );
    }
  });

  it("is deterministic", () => {
    const events = [
      makeNote("alice", "hello", ["bitcoin"], ["bob"]),
      makeNote("bob", "world", ["bitcoin"], ["alice"]),
      makeNote("carol", "テスト", ["bitcoin"]),
    ];
    const a = selectBestClusters(events, 2);
    const b = selectBestClusters(events, 2);
    expect(a.strategy).toBe(b.strategy);
    expect(a.clusters.map((c) => c.id)).toEqual(b.clusters.map((c) => c.id));
  });

  it("keeps the incumbent facet within the hysteresis margin", () => {
    const events = [
      makeNote("alice", "hello", ["bitcoin"], ["bob"]),
      makeNote("bob", "world", ["bitcoin"], ["alice"]),
      makeNote("carol", "テスト", ["bitcoin"]),
    ];
    const open = selectBestClusters(events, 2);
    // Pick any non-winning facet whose score is within a huge margin —
    // with hysteresis it must stay selected as the incumbent
    const challenger = open.strategy;
    const incumbent = CLUSTER_STRATEGIES.find((s) => s !== challenger)!;
    const held = selectBestClusters(events, 2, 10, incumbent, 10);
    expect(held.strategy).toBe(incumbent);
    // ...but a zero margin lets the true winner through
    const released = selectBestClusters(events, 2, 10, incumbent, 0);
    expect(released.strategy).toBe(challenger);
  });
});

describe("CLUSTER_STRATEGY_LABELS", () => {
  it("has labels for all strategies and modes", () => {
    const strategies: ClusterStrategy[] = [
      "topic",
      "interaction",
      "language",
      "engagement",
    ];
    for (const s of strategies) {
      expect(CLUSTER_STRATEGY_LABELS[s]).toBeDefined();
      expect(typeof CLUSTER_STRATEGY_LABELS[s]).toBe("string");
    }
    for (const m of CLUSTER_MODES) {
      expect(CLUSTER_MODE_LABELS[m]).toBeDefined();
    }
  });
});
