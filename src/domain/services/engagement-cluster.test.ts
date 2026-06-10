import { describe, it, expect } from "vitest";
import {
  detectEngagementClusters,
  quintileScores,
} from "./engagement-cluster";
import type { NostrEvent } from "@/domain/entities/nostr-event";
import { NOSTR_KIND } from "@/lib/nostr-kinds";

let eventCounter = 0;
function note(pubkey: string, createdAt: number): NostrEvent {
  return {
    id: `note-${eventCounter++}`,
    pubkey,
    created_at: createdAt,
    kind: NOSTR_KIND.TEXT_NOTE,
    tags: [],
    content: "hello",
    sig: "",
  };
}

function reaction(pubkey: string, target: string): NostrEvent {
  return {
    id: `reaction-${eventCounter++}`,
    pubkey,
    created_at: 1000,
    kind: NOSTR_KIND.REACTION,
    tags: [["p", target]],
    content: "+",
    sig: "",
  };
}

describe("quintileScores", () => {
  it("assigns 1..5 by ascending rank", () => {
    const values = new Map(
      Array.from({ length: 10 }, (_, i) => [`u${i}`, i] as [string, number]),
    );
    const scores = quintileScores(values);
    expect(scores.get("u0")).toBe(1);
    expect(scores.get("u1")).toBe(1);
    expect(scores.get("u4")).toBe(3);
    expect(scores.get("u8")).toBe(5);
    expect(scores.get("u9")).toBe(5);
  });

  it("gives equal values equal scores", () => {
    const values = new Map<string, number>([
      ["a", 1],
      ["b", 1],
      ["c", 1],
      ["d", 10],
      ["e", 20],
    ]);
    const scores = quintileScores(values);
    expect(scores.get("a")).toBe(scores.get("b"));
    expect(scores.get("b")).toBe(scores.get("c"));
    expect(scores.get("e")).toBe(5);
  });

  it("handles a single user", () => {
    const scores = quintileScores(new Map([["solo", 42]]));
    expect(scores.get("solo")).toBe(1);
  });
});

describe("detectEngagementClusters", () => {
  it("returns empty for no events", () => {
    expect(detectEngagementClusters([])).toEqual([]);
  });

  it("puts recent prolific high-engagement users into Champions", () => {
    const events: NostrEvent[] = [];
    const now = 100_000;

    // 3 champions: recent, many notes, lots of reactions received
    for (const star of ["star1", "star2", "star3"]) {
      for (let i = 0; i < 10; i++) events.push(note(star, now - i));
      for (let i = 0; i < 10; i++) events.push(reaction(`fan${i}`, star));
    }
    // 12 quiet users: old single notes, no engagement
    for (let i = 0; i < 12; i++) {
      events.push(note(`quiet${i}`, 1000 + i));
    }

    const clusters = detectEngagementClusters(events, 3);
    const champions = clusters.find((c) => c.id === "engagement-champions");
    expect(champions).toBeDefined();
    expect(champions!.memberPubkeys.has("star1")).toBe(true);
    expect(champions!.memberPubkeys.has("star2")).toBe(true);
    expect(champions!.memberPubkeys.has("star3")).toBe(true);
    expect(champions!.label).toBe("Champions");
    expect(champions!.labelLocked).toBe(true);
  });

  it("puts inactive low-engagement users into Hibernating", () => {
    const events: NostrEvent[] = [];
    const now = 100_000;
    for (const star of ["star1", "star2", "star3"]) {
      for (let i = 0; i < 10; i++) events.push(note(star, now - i));
      for (let i = 0; i < 10; i++) events.push(reaction(`fan${i}`, star));
    }
    for (let i = 0; i < 12; i++) {
      events.push(note(`quiet${i}`, 1000 + i));
    }

    const clusters = detectEngagementClusters(events, 3);
    const hibernating = clusters.find(
      (c) => c.id === "engagement-hibernating",
    );
    expect(hibernating).toBeDefined();
    expect(hibernating!.memberPubkeys.has("quiet0")).toBe(true);
  });

  it("assigns every posting user to exactly one segment", () => {
    const events: NostrEvent[] = [];
    for (let i = 0; i < 20; i++) {
      events.push(note(`user${i}`, 1000 + i * 100));
      if (i % 2 === 0) events.push(note(`user${i}`, 2000 + i));
      if (i % 3 === 0) events.push(reaction("someone", `user${i}`));
    }
    const clusters = detectEngagementClusters(events, 1);
    const seen = new Set<string>();
    for (const c of clusters) {
      for (const pk of c.memberPubkeys) {
        expect(seen.has(pk)).toBe(false);
        seen.add(pk);
      }
    }
    expect(seen.size).toBe(20);
  });

  it("drops segments smaller than minClusterSize", () => {
    const events = [note("a", 1), note("b", 2)];
    const clusters = detectEngagementClusters(events, 3);
    expect(clusters).toEqual([]);
  });

  it("is deterministic regardless of event order", () => {
    const events: NostrEvent[] = [];
    for (let i = 0; i < 15; i++) {
      events.push(note(`user${i}`, 1000 + i * 37));
      events.push(reaction(`user${(i + 1) % 15}`, `user${i}`));
    }
    const a = detectEngagementClusters(events, 2);
    const b = detectEngagementClusters([...events].reverse(), 2);
    expect(a.map((c) => [c.id, [...c.memberPubkeys].sort()])).toEqual(
      b.map((c) => [c.id, [...c.memberPubkeys].sort()]),
    );
  });
});
