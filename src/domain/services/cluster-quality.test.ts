import { describe, it, expect } from "vitest";
import { evaluateClusterQuality } from "./cluster-quality";
import type { NostrEvent } from "@/domain/entities/nostr-event";
import type { Cluster } from "@/domain/entities/cluster";
import { NOSTR_KIND } from "@/lib/nostr-kinds";

let counter = 0;
function note(pubkey: string, targets: string[] = []): NostrEvent {
  return {
    id: `ev-${counter++}`,
    pubkey,
    created_at: 1000,
    kind: NOSTR_KIND.TEXT_NOTE,
    tags: targets.map((t) => ["p", t]),
    content: "x",
    sig: "",
  };
}

function cluster(id: string, members: string[]): Cluster {
  return {
    id,
    label: id,
    hashtags: [],
    memberPubkeys: new Set(members),
    color: "#fff",
  };
}

/** Two tight reply-circles: a1-a2-a3 and b1-b2-b3 */
function twoGroupEvents(): NostrEvent[] {
  const events: NostrEvent[] = [];
  for (const g of [["a1", "a2", "a3"], ["b1", "b2", "b3"]]) {
    for (const x of g) {
      for (const y of g) {
        if (x < y) events.push(note(x, [y]));
      }
    }
  }
  return events;
}

describe("evaluateClusterQuality", () => {
  it("scores the structure-aligned partition above the misaligned one", () => {
    const events = twoGroupEvents();
    const aligned = [
      cluster("c1", ["a1", "a2", "a3"]),
      cluster("c2", ["b1", "b2", "b3"]),
    ];
    const misaligned = [
      cluster("c1", ["a1", "b2", "a3"]),
      cluster("c2", ["b1", "a2", "b3"]),
    ];
    const qa = evaluateClusterQuality(aligned, events);
    const qm = evaluateClusterQuality(misaligned, events);
    expect(qa.modularity).toBeGreaterThan(qm.modularity);
    expect(qa.score).toBeGreaterThan(qm.score);
  });

  it("computes full coverage when all note authors are assigned", () => {
    const events = twoGroupEvents();
    const clusters = [
      cluster("c1", ["a1", "a2", "a3"]),
      cluster("c2", ["b1", "b2", "b3"]),
    ];
    const q = evaluateClusterQuality(clusters, events);
    expect(q.coverage).toBe(1);
  });

  it("penalizes partial coverage", () => {
    const events = twoGroupEvents();
    const clusters = [cluster("c1", ["a1", "a2", "a3"])];
    const q = evaluateClusterQuality(clusters, events);
    expect(q.coverage).toBeCloseTo(0.5, 10);
  });

  it("gives balanced partitions higher balance than skewed ones", () => {
    const events = twoGroupEvents();
    const balanced = [
      cluster("c1", ["a1", "a2", "a3"]),
      cluster("c2", ["b1", "b2", "b3"]),
    ];
    const skewed = [
      cluster("c1", ["a1", "a2", "a3", "b1", "b2"]),
      cluster("c2", ["b3"]),
    ];
    expect(
      evaluateClusterQuality(balanced, events).balance,
    ).toBeGreaterThan(evaluateClusterQuality(skewed, events).balance);
  });

  it("heavily discounts single-cluster partitions", () => {
    const events = twoGroupEvents();
    const single = [
      cluster("c1", ["a1", "a2", "a3", "b1", "b2", "b3"]),
    ];
    const q = evaluateClusterQuality(single, events);
    expect(q.numClusters).toBe(1);
    expect(q.score).toBeLessThan(0.2);
  });

  it("handles empty inputs", () => {
    const q = evaluateClusterQuality([], []);
    expect(q.score).toBe(0);
    expect(q.coverage).toBe(0);
    expect(q.modularity).toBe(0);
  });
});
