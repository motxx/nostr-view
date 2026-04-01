import { describe, it, expect } from "vitest";
import {
  assignTiers,
  influenceToSize,
  influenceToColor,
  pulsePeriod,
  tierBrightness,
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

describe("tierBrightness", () => {
  it("returns a valid hex color", () => {
    expect(tierBrightness("#4fc3f7", "star")).toMatch(/^#[0-9a-f]{6}$/);
    expect(tierBrightness("#4fc3f7", "planet")).toMatch(/^#[0-9a-f]{6}$/);
    expect(tierBrightness("#4fc3f7", "dust")).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("star is brighter than planet", () => {
    const base = "#808080";
    const star = tierBrightness(base, "star");
    const planet = tierBrightness(base, "planet");
    // Compare green channel (chars 3-5)
    expect(parseInt(star.slice(3, 5), 16)).toBeGreaterThan(
      parseInt(planet.slice(3, 5), 16),
    );
  });

  it("planet is unchanged from input", () => {
    expect(tierBrightness("#808080", "planet")).toBe("#808080");
  });

  it("dust is darker than planet", () => {
    const base = "#808080";
    const planet = tierBrightness(base, "planet");
    const dust = tierBrightness(base, "dust");
    expect(parseInt(dust.slice(3, 5), 16)).toBeLessThan(
      parseInt(planet.slice(3, 5), 16),
    );
  });

  it("clamps to 255 for bright inputs", () => {
    const result = tierBrightness("#ffffff", "star");
    expect(result).toBe("#ffffff");
  });
});
