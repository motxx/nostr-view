import { describe, it, expect } from "vitest";
import {
  assignTiers,
  influenceToSize,
  influenceToColor,
  pulsePeriod,
  tierBrightness,
} from "./graph-utils";

describe("assignTiers", () => {
  it("assigns hub to top 10 nodes", () => {
    const nodes = Array.from({ length: 60 }, (_, i) => ({
      id: `n${i}`,
      influenceScore: 60 - i,
    }));
    const tiers = assignTiers(nodes);

    // Top 10 by score → hub
    for (let i = 0; i < 10; i++) {
      expect(tiers.get(`n${i}`)).toBe("hub");
    }
  });

  it("assigns node to next 40 nodes", () => {
    const nodes = Array.from({ length: 60 }, (_, i) => ({
      id: `n${i}`,
      influenceScore: 60 - i,
    }));
    const tiers = assignTiers(nodes);

    for (let i = 10; i < 50; i++) {
      expect(tiers.get(`n${i}`)).toBe("node");
    }
  });

  it("assigns edge to remaining nodes", () => {
    const nodes = Array.from({ length: 60 }, (_, i) => ({
      id: `n${i}`,
      influenceScore: 60 - i,
    }));
    const tiers = assignTiers(nodes);

    for (let i = 50; i < 60; i++) {
      expect(tiers.get(`n${i}`)).toBe("edge");
    }
  });

  it("handles fewer than 10 nodes — all are hubs", () => {
    const nodes = [
      { id: "a", influenceScore: 10 },
      { id: "b", influenceScore: 5 },
    ];
    const tiers = assignTiers(nodes);
    expect(tiers.get("a")).toBe("hub");
    expect(tiers.get("b")).toBe("hub");
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

describe("tierBrightness", () => {
  it("returns a valid hex color", () => {
    expect(tierBrightness("#4fc3f7", "hub")).toMatch(/^#[0-9a-f]{6}$/);
    expect(tierBrightness("#4fc3f7", "node")).toMatch(/^#[0-9a-f]{6}$/);
    expect(tierBrightness("#4fc3f7", "edge")).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("hub is brighter than node", () => {
    const base = "#808080";
    const hub = tierBrightness(base, "hub");
    const node = tierBrightness(base, "node");
    // Compare green channel (chars 3-5)
    expect(parseInt(hub.slice(3, 5), 16)).toBeGreaterThan(
      parseInt(node.slice(3, 5), 16),
    );
  });

  it("node is unchanged from input", () => {
    expect(tierBrightness("#808080", "node")).toBe("#808080");
  });

  it("edge is darker than node", () => {
    const base = "#808080";
    const node = tierBrightness(base, "node");
    const edge = tierBrightness(base, "edge");
    expect(parseInt(edge.slice(3, 5), 16)).toBeLessThan(
      parseInt(node.slice(3, 5), 16),
    );
  });

  it("clamps to 255 for bright inputs", () => {
    const result = tierBrightness("#ffffff", "hub");
    expect(result).toBe("#ffffff");
  });
});
