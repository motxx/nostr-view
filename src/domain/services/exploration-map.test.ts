import { describe, it, expect } from "vitest";
import { computeExplorationMap } from "./exploration-map";
import type { BridgeInfo } from "./cluster-summary";

function makeBridges(
  entries: [string, { target: string; pubkeys: string[] }[]][],
): Map<string, BridgeInfo[]> {
  const map = new Map<string, BridgeInfo[]>();
  for (const [id, targets] of entries) {
    map.set(
      id,
      targets.map((t) => ({
        targetClusterId: t.target,
        sharedCount: t.pubkeys.length,
        bridgePubkeys: t.pubkeys,
      })),
    );
  }
  return map;
}

describe("computeExplorationMap", () => {
  it("returns 100% coverage when all clusters are connected", () => {
    const bridges = makeBridges([
      ["A", [{ target: "B", pubkeys: ["p1"] }]],
      ["B", [{ target: "A", pubkeys: ["p1"] }, { target: "C", pubkeys: ["p2"] }]],
      ["C", [{ target: "B", pubkeys: ["p2"] }]],
    ]);
    const result = computeExplorationMap("A", ["A", "B", "C"], bridges);
    expect(result.coverage).toBe(1);
    expect(result.reachability.get("A")).toBe(0);
    expect(result.reachability.get("B")).toBe(1);
    expect(result.reachability.get("C")).toBe(2);
    expect(result.recommendations).toHaveLength(0);
  });

  it("detects isolated clusters as unreachable", () => {
    const bridges = makeBridges([
      ["A", [{ target: "B", pubkeys: ["p1"] }]],
      ["B", [{ target: "A", pubkeys: ["p1"] }]],
      ["C", []], // isolated
    ]);
    const result = computeExplorationMap("A", ["A", "B", "C"], bridges);
    expect(result.coverage).toBeCloseTo(2 / 3);
    expect(result.reachability.get("C")).toBe(Infinity);
  });

  it("recommends bridge for unreachable cluster adjacent to reachable one", () => {
    // A ↔ B, C is isolated but B has a bridge to C
    const bridges = makeBridges([
      ["A", [{ target: "B", pubkeys: ["p1"] }]],
      ["B", [{ target: "A", pubkeys: ["p1"] }, { target: "C", pubkeys: ["p2"] }]],
      ["C", []], // no outgoing bridges (one-way from B)
    ]);
    // C is not reachable via BFS because C has no bridge back
    // But wait — BFS goes A→B, B has bridge to C → C is reachable at dist 2
    const result = computeExplorationMap("A", ["A", "B", "C"], bridges);
    expect(result.reachability.get("C")).toBe(2);
    expect(result.coverage).toBe(1);
  });

  it("handles truly isolated cluster with recommendation", () => {
    // A connects to B, but C is truly isolated (no bridges to/from it)
    const bridges = makeBridges([
      ["A", [{ target: "B", pubkeys: ["p1"] }]],
      ["B", [{ target: "A", pubkeys: ["p1"] }]],
      ["C", []],
    ]);
    const result = computeExplorationMap("A", ["A", "B", "C"], bridges);
    expect(result.reachability.get("C")).toBe(Infinity);
    // No bridge leads to C, so no recommendation possible
    expect(result.recommendations).toHaveLength(0);
  });

  it("provides recommendation when reachable cluster has bridge to unreachable", () => {
    // A→B connected. D exists. B has a one-way knowledge of D.
    const bridges = makeBridges([
      ["A", [{ target: "B", pubkeys: ["p1"] }]],
      ["B", [{ target: "A", pubkeys: ["p1"] }, { target: "D", pubkeys: ["p3"] }]],
      ["D", []],
    ]);
    const result = computeExplorationMap("A", ["A", "B", "D"], bridges);
    // B→D bridge exists, so D is reachable at dist 2
    expect(result.reachability.get("D")).toBe(2);
  });

  it("returns empty map for empty cluster list", () => {
    const result = computeExplorationMap("A", [], new Map());
    expect(result.coverage).toBe(0);
    expect(result.recommendations).toHaveLength(0);
  });

  it("coverage is 1 for single cluster", () => {
    const result = computeExplorationMap("A", ["A"], new Map());
    expect(result.coverage).toBe(1);
    expect(result.reachability.get("A")).toBe(0);
  });
});
