import { describe, it, expect } from "vitest";
import { formatTimeOffset } from "./time-format";

describe("formatTimeOffset", () => {
  it('returns "LIVE" when endSec equals nowSec', () => {
    expect(formatTimeOffset(1000, 1000)).toBe("LIVE");
  });

  it('returns "LIVE" when endSec is ahead of nowSec', () => {
    expect(formatTimeOffset(1000, 1100)).toBe("LIVE");
  });

  it("returns minutes offset for < 60 min", () => {
    // 30 minutes ago
    expect(formatTimeOffset(1000, 1000 - 30 * 60)).toBe("-30m");
  });

  it("returns hours and minutes for >= 60 min", () => {
    // 90 minutes ago
    expect(formatTimeOffset(1000, 1000 - 90 * 60)).toBe("-1h30m");
  });

  it("returns hours with 0 remainder minutes", () => {
    // exactly 2 hours ago
    expect(formatTimeOffset(1000, 1000 - 120 * 60)).toBe("-2h0m");
  });
});
