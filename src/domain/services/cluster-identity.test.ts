import { describe, it, expect } from "vitest";
import { reconcileClusters } from "./cluster-identity";
import { clusterFingerprint, type Cluster } from "@/domain/entities/cluster";

function cluster(
  id: string,
  members: string[],
  overrides: Partial<Cluster> = {},
): Cluster {
  return {
    id,
    label: id,
    hashtags: [],
    memberPubkeys: new Set(members),
    color: "#fff",
    ...overrides,
  };
}

describe("reconcileClusters", () => {
  it("returns next unchanged when previous is empty", () => {
    const next = [cluster("interaction-0", ["a", "b", "c"])];
    expect(reconcileClusters([], next)).toBe(next);
  });

  it("inherits id and color when members overlap strongly", () => {
    const prev = [
      cluster("interaction-0", ["a", "b", "c", "d"], { color: "#f00" }),
    ];
    const next = [
      cluster("interaction-2", ["a", "b", "c", "e"], { color: "#00f" }),
    ];
    const result = reconcileClusters(prev, next);
    expect(result[0].id).toBe("interaction-0");
    expect(result[0].color).toBe("#f00");
  });

  it("inherits the naming fingerprint so LLM headlines stick", () => {
    const prev = [
      cluster("interaction-0", ["a", "b", "c"], {
        hashtags: ["bitcoin", "lightning"],
      }),
    ];
    const prevFp = clusterFingerprint(prev[0]); // "bitcoin+lightning"
    // Tags evolved on recompute — naive fingerprint would change
    const next = [
      cluster("interaction-0", ["a", "b", "c", "d"], {
        hashtags: ["bitcoin", "nodes"],
      }),
    ];
    const result = reconcileClusters(prev, next);
    expect(clusterFingerprint(result[0])).toBe(prevFp);
  });

  it("chains identity across multiple recomputes", () => {
    const gen1 = [
      cluster("interaction-0", ["a", "b", "c"], { hashtags: ["x"] }),
    ];
    const gen2 = reconcileClusters(gen1, [
      cluster("interaction-1", ["a", "b", "c", "d"], { hashtags: ["y"] }),
    ]);
    const gen3 = reconcileClusters(gen2, [
      cluster("interaction-5", ["a", "b", "d", "e"], { hashtags: ["z"] }),
    ]);
    expect(gen3[0].id).toBe("interaction-0");
    expect(clusterFingerprint(gen3[0])).toBe(clusterFingerprint(gen1[0]));
  });

  it("does not match below the Jaccard threshold", () => {
    const prev = [cluster("interaction-0", ["a", "b", "c", "d", "e"])];
    const next = [cluster("interaction-1", ["a", "x", "y", "z", "w"])];
    const result = reconcileClusters(prev, next);
    expect(result[0].id).toBe("interaction-1");
  });

  it("matches greedily by best overlap, one-to-one", () => {
    const prev = [
      cluster("prev-big", ["a", "b", "c", "d"]),
      cluster("prev-small", ["x", "y", "z"]),
    ];
    const next = [
      // overlaps both, but much closer to prev-big
      cluster("next-0", ["a", "b", "c", "d", "e"]),
      cluster("next-1", ["x", "y", "z"]),
    ];
    const result = reconcileClusters(prev, next);
    expect(result[0].id).toBe("prev-big");
    expect(result[1].id).toBe("prev-small");
  });

  it("suffixes a new cluster whose id collides with an inherited id", () => {
    const prev = [cluster("interaction-0", ["a", "b", "c"])];
    const next = [
      // this one inherits "interaction-0"
      cluster("interaction-1", ["a", "b", "c"]),
      // this genuinely new one happens to be computed as "interaction-0"
      cluster("interaction-0", ["p", "q", "r"]),
    ];
    const result = reconcileClusters(prev, next);
    expect(result[0].id).toBe("interaction-0");
    expect(result[1].id).toBe("interaction-0~");
    const ids = new Set(result.map((c) => c.id));
    expect(ids.size).toBe(2);
  });

  it("keeps member sets and labels from the NEW computation", () => {
    const prev = [
      cluster("interaction-0", ["a", "b", "c"], { label: "Old Label" }),
    ];
    const next = [
      cluster("interaction-1", ["a", "b", "c", "d"], { label: "fresh, tags" }),
    ];
    const result = reconcileClusters(prev, next);
    expect(result[0].memberPubkeys.has("d")).toBe(true);
    expect(result[0].label).toBe("fresh, tags");
  });

  it("is a no-op for stable locked clusters (same ids)", () => {
    const prev = [
      cluster("lang-Japanese", ["a", "b", "c"], { labelLocked: true }),
    ];
    const next = [
      cluster("lang-Japanese", ["a", "b", "c", "d"], { labelLocked: true }),
    ];
    const result = reconcileClusters(prev, next);
    expect(result[0].id).toBe("lang-Japanese");
    expect(clusterFingerprint(result[0])).toBe("lang-Japanese");
  });
});
