import { describe, it, expect } from "vitest";
import { getClusterColor } from "./cluster";

describe("getClusterColor", () => {
  it("returns a color string for index 0", () => {
    const color = getClusterColor(0);
    expect(color).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("returns different colors for different indices", () => {
    const colors = new Set<string>();
    for (let i = 0; i < 10; i++) {
      colors.add(getClusterColor(i));
    }
    expect(colors.size).toBe(10);
  });

  it("wraps around after 10 colors", () => {
    expect(getClusterColor(0)).toBe(getClusterColor(10));
    expect(getClusterColor(3)).toBe(getClusterColor(13));
  });
});
