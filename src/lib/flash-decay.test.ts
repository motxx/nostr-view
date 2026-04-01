import { describe, it, expect } from "vitest";
import { flashBoost } from "./flash-decay";

describe("flashBoost", () => {
  const ttl = 1000;

  it("returns ~2x at t=0", () => {
    const boost = flashBoost(0, ttl);
    expect(boost).toBeCloseTo(2.0, 1);
  });

  it("returns 1.0 at t=ttl", () => {
    expect(flashBoost(ttl, ttl)).toBe(1);
  });

  it("returns 1.0 beyond ttl", () => {
    expect(flashBoost(ttl + 500, ttl)).toBe(1);
  });

  it("is monotonically decreasing from 0 to ttl", () => {
    let prev = flashBoost(0, ttl);
    for (let t = 50; t <= ttl; t += 50) {
      const current = flashBoost(t, ttl);
      expect(current).toBeLessThanOrEqual(prev);
      prev = current;
    }
  });

  it("is always >= 1.0", () => {
    for (let t = 0; t <= ttl + 200; t += 10) {
      expect(flashBoost(t, ttl)).toBeGreaterThanOrEqual(1);
    }
  });

  it("returns 1 for negative elapsed", () => {
    expect(flashBoost(-100, ttl)).toBe(1);
  });
});
