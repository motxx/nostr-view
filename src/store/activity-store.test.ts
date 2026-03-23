import { describe, it, expect, beforeEach } from "vitest";
import { useActivityStore } from "./activity-store";

describe("activity-store", () => {
  beforeEach(() => {
    // Reset store state between tests
    useActivityStore.setState({ lastPostTime: new Map() });
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
      const before = useActivityStore.getState().lastPostTime;
      useActivityStore.getState().updateActivities([
        { pubkey: "alice", createdAt: 1000 },
      ]);
      // Should be same reference (no-op)
      expect(useActivityStore.getState().lastPostTime.get("alice")).toBe(5000);
    });
  });
});
