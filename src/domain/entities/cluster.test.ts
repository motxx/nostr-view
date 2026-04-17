import { describe, it, expect } from "vitest";
import { getClusterColor, clusterFingerprint, type Cluster } from "./cluster";

function makeCluster(overrides: Partial<Cluster> = {}): Cluster {
  return {
    id: "cluster-0",
    label: "test",
    hashtags: ["bitcoin", "nostr", "lightning"],
    memberPubkeys: new Set(["alice"]),
    color: "#fff",
    ...overrides,
  };
}

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

describe("clusterFingerprint", () => {
  it("sorts hashtags alphabetically and joins top 5", () => {
    const c = makeCluster({ hashtags: ["nostr", "bitcoin", "lightning"] });
    expect(clusterFingerprint(c)).toBe("bitcoin+lightning+nostr");
  });

  it("produces the same fingerprint regardless of cluster ID", () => {
    const c1 = makeCluster({ id: "cluster-0" });
    const c2 = makeCluster({ id: "cluster-7" });
    expect(clusterFingerprint(c1)).toBe(clusterFingerprint(c2));
  });

  it("limits to 5 hashtags", () => {
    const c = makeCluster({
      hashtags: ["a", "b", "c", "d", "e", "f", "g"],
    });
    expect(clusterFingerprint(c)).toBe("a+b+c+d+e");
  });

  it("falls back to cluster ID when no hashtags", () => {
    const c = makeCluster({ id: "lang-Japanese", hashtags: [] });
    expect(clusterFingerprint(c)).toBe("lang-Japanese");
  });
});
