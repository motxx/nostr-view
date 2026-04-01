import { describe, it, expect } from "vitest";
import { computeHistogram, filterEventsByTimeRange } from "./event-histogram";
import type { NostrEvent } from "@/domain/entities/nostr-event";

function makeEvent(created_at: number): NostrEvent {
  return {
    id: `evt-${created_at}`,
    pubkey: "pk",
    created_at,
    kind: 1,
    tags: [],
    content: "",
    sig: "",
  };
}

describe("computeHistogram", () => {
  it("distributes events into correct buckets", () => {
    const events = [
      makeEvent(100),
      makeEvent(150),
      makeEvent(350),
    ];
    const buckets = computeHistogram(events, 0, 600, 300);
    expect(buckets).toHaveLength(2);
    expect(buckets[0].count).toBe(2); // 100, 150 in [0, 300)
    expect(buckets[1].count).toBe(1); // 350 in [300, 600)
  });

  it("excludes events outside window", () => {
    const events = [makeEvent(50), makeEvent(700)];
    const buckets = computeHistogram(events, 100, 600, 300);
    expect(buckets[0].count).toBe(0);
    expect(buckets[1].count).toBe(0);
  });

  it("returns empty for invalid range", () => {
    expect(computeHistogram([], 600, 100, 300)).toHaveLength(0);
  });

  it("handles bucket size larger than window", () => {
    const events = [makeEvent(50)];
    const buckets = computeHistogram(events, 0, 100, 500);
    expect(buckets).toHaveLength(1);
    expect(buckets[0].count).toBe(1);
  });

  it("handles events at bucket boundaries", () => {
    const events = [makeEvent(300)]; // exactly at boundary
    const buckets = computeHistogram(events, 0, 600, 300);
    expect(buckets[0].count).toBe(0); // 300 is not in [0, 300)
    expect(buckets[1].count).toBe(1); // 300 is in [300, 600)
  });
});

describe("filterEventsByTimeRange", () => {
  it("includes events within range", () => {
    const events = [makeEvent(100), makeEvent(200), makeEvent(300)];
    const filtered = filterEventsByTimeRange(events, 100, 300);
    expect(filtered).toHaveLength(2); // 100, 200 (300 excluded: [start, end))
  });

  it("excludes events outside range", () => {
    const events = [makeEvent(50), makeEvent(400)];
    const filtered = filterEventsByTimeRange(events, 100, 300);
    expect(filtered).toHaveLength(0);
  });

  it("returns empty for empty input", () => {
    expect(filterEventsByTimeRange([], 0, 100)).toHaveLength(0);
  });
});
