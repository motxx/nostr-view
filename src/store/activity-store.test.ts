import { describe, it, expect, beforeEach } from "vitest";
import { useActivityStore } from "./activity-store";

describe("activity-store", () => {
  beforeEach(() => {
    // Reset store state between tests
    useActivityStore.setState({
      lastPostTime: new Map(),
      flashQueue: new Set(),
      flashTimestamps: new Map(),
      eventRate: 0,
      _eventArrivals: [],
    });
  });

  it("starts with an empty map", () => {
    expect(useActivityStore.getState().lastPostTime.size).toBe(0);
  });

  describe("updateActivity", () => {
    it("sets lastPostTime for a new pubkey", () => {
      useActivityStore.getState().updateActivity("alice", 1000);
      expect(useActivityStore.getState().lastPostTime.get("alice")).toBe(1000);
    });

    it("updates to a newer timestamp", () => {
      useActivityStore.getState().updateActivity("alice", 1000);
      useActivityStore.getState().updateActivity("alice", 2000);
      expect(useActivityStore.getState().lastPostTime.get("alice")).toBe(2000);
    });

    it("ignores older timestamps", () => {
      useActivityStore.getState().updateActivity("alice", 2000);
      useActivityStore.getState().updateActivity("alice", 1000);
      expect(useActivityStore.getState().lastPostTime.get("alice")).toBe(2000);
    });
  });

  describe("updateActivities (batch)", () => {
    it("updates multiple pubkeys at once", () => {
      useActivityStore.getState().updateActivities([
        { pubkey: "alice", createdAt: 1000 },
        { pubkey: "bob", createdAt: 2000 },
      ]);
      const map = useActivityStore.getState().lastPostTime;
      expect(map.get("alice")).toBe(1000);
      expect(map.get("bob")).toBe(2000);
    });

    it("keeps the latest timestamp per pubkey", () => {
      useActivityStore.getState().updateActivities([
        { pubkey: "alice", createdAt: 1000 },
        { pubkey: "alice", createdAt: 3000 },
        { pubkey: "alice", createdAt: 2000 },
      ]);
      expect(useActivityStore.getState().lastPostTime.get("alice")).toBe(3000);
    });

    it("does not trigger update when all timestamps are older", () => {
      useActivityStore.getState().updateActivity("alice", 5000);
      useActivityStore.getState().updateActivities([
        { pubkey: "alice", createdAt: 1000 },
      ]);
      // Should be same reference (no-op)
      expect(useActivityStore.getState().lastPostTime.get("alice")).toBe(5000);
    });
  });

  describe("flashQueue", () => {
    it("addFlash adds pubkey to flashQueue", () => {
      useActivityStore.getState().addFlash("alice");
      expect(useActivityStore.getState().flashQueue.has("alice")).toBe(true);
    });

    it("addFlash sets flashTimestamp", () => {
      const before = Date.now();
      useActivityStore.getState().addFlash("alice");
      const ts = useActivityStore.getState().flashTimestamps.get("alice")!;
      expect(ts).toBeGreaterThanOrEqual(before);
      expect(ts).toBeLessThanOrEqual(Date.now());
    });

    it("clearExpiredFlashes removes expired entries", () => {
      useActivityStore.getState().addFlash("alice");
      // Manually set timestamp to 2 seconds ago
      const old = new Map(useActivityStore.getState().flashTimestamps);
      old.set("alice", Date.now() - 2000);
      useActivityStore.setState({ flashTimestamps: old });

      useActivityStore.getState().clearExpiredFlashes(Date.now(), 1000);
      expect(useActivityStore.getState().flashQueue.has("alice")).toBe(false);
    });

    it("clearExpiredFlashes keeps fresh entries", () => {
      useActivityStore.getState().addFlash("alice");
      useActivityStore.getState().clearExpiredFlashes(Date.now(), 1000);
      expect(useActivityStore.getState().flashQueue.has("alice")).toBe(true);
    });

    it("clearExpiredFlashes is a no-op on empty queue", () => {
      // Should not throw
      useActivityStore.getState().clearExpiredFlashes(Date.now());
    });
  });

  describe("eventRate", () => {
    it("recordEventArrival increases eventRate", () => {
      useActivityStore.getState().recordEventArrival();
      useActivityStore.getState().recordEventArrival();
      useActivityStore.getState().recordEventArrival();
      const rate = useActivityStore.getState().eventRate;
      // 3 events in 60s window → 3/60 = 0.05
      expect(rate).toBeCloseTo(3 / 60, 2);
    });

    it("stale arrivals are pruned", () => {
      // Insert an old arrival
      const old = Date.now() - 70_000;
      useActivityStore.setState({ _eventArrivals: [old] });
      useActivityStore.getState().recordEventArrival();
      // Only the new one survives
      expect(useActivityStore.getState()._eventArrivals.length).toBe(1);
    });
  });
});
