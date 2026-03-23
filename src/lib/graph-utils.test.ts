import { describe, it, expect } from "vitest";
import {
  assignTiers,
  influenceToSize,
  influenceToColor,
  pulsePeriod,
} from "./graph-utils";

describe("assignTiers", () => {
  it("assigns star to top 10 nodes", () => {
    const nodes = Array.from({ length: 60 }, (_, i) => ({
      id: `n${i}`,
      influenceScore: 60 - i,
    }));
    const tiers = assignTiers(nodes);

    // Top 10 by score → star
    for (let i = 0; i < 10; i++) {
      expect(tiers.get(`n${i}`)).toBe("star");
    }
  });

  it("assigns planet to next 40 nodes", () => {
    const nodes = Array.from({ length: 60 }, (_, i) => ({
      id: `n${i}`,
      influenceScore: 60 - i,
    }));
    const tiers = assignTiers(nodes);

    for (let i = 10; i < 50; i++) {
      expect(tiers.get(`n${i}`)).toBe("planet");
    }
  });

  it("assigns dust to remaining nodes", () => {
    const nodes = Array.from({ length: 60 }, (_, i) => ({
      id: `n${i}`,
      influenceScore: 60 - i,
    }));
    const tiers = assignTiers(nodes);

    for (let i = 50; i < 60; i++) {
      expect(tiers.get(`n${i}`)).toBe("dust");
    }
  });

  it("handles fewer than 10 nodes — all are stars", () => {
    const nodes = [
      { id: "a", influenceScore: 10 },
      { id: "b", influenceScore: 5 },
    ];
    const tiers = assignTiers(nodes);
    expect(tiers.get("a")).toBe("star");
    expect(tiers.get("b")).toBe("star");
  });
});

describe("influenceToSize", () => {
  it("returns minimum 2 for score 0", () => {
    expect(influenceToSize(0)).toBe(2);
  });

  it("returns at most 20", () => {
    expect(influenceToSize(999999)).toBeLessThanOrEqual(20);
  });

  it("increases with score", () => {
    expect(influenceToSize(50)).toBeGreaterThan(influenceToSize(1));
  });
});

describe("influenceToColor", () => {
  it("returns baseColor when provided", () => {
    expect(influenceToColor(50, "#ff0000")).toBe("#ff0000");
  });

  it("returns a valid hex color", () => {
    const color = influenceToColor(50);
    expect(color).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe("pulsePeriod", () => {
  it("returns ~1s for a post just now", () => {
    const now = 1000;
    expect(pulsePeriod(now, now)).toBeCloseTo(1);
  });

  it("returns ~5s for a post 2 hours ago", () => {
    const now = 10000;
    expect(pulsePeriod(now - 7200, now)).toBeCloseTo(5);
  });

  it("returns 0 (static) for posts older than 2 hours", () => {
    const now = 10000;
    expect(pulsePeriod(now - 7201, now)).toBe(0);
  });

  it("linearly interpolates between 1 and 5", () => {
    const now = 10000;
    // 1 hour ago → 3s (midpoint)
    expect(pulsePeriod(now - 3600, now)).toBeCloseTo(3);
  });
});
