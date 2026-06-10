import { describe, it, expect } from "vitest";
import {
  louvain,
  computeModularity,
  addUndirectedEdge,
  type WeightedGraph,
} from "./louvain";

function clique(graph: WeightedGraph, nodes: string[], weight = 1) {
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      addUndirectedEdge(graph, nodes[i], nodes[j], weight);
    }
  }
}

describe("louvain", () => {
  it("returns empty result for empty graph", () => {
    const { communities, modularity } = louvain(new Map());
    expect(communities.size).toBe(0);
    expect(modularity).toBe(0);
  });

  it("separates two cliques joined by a single weak edge", () => {
    const graph: WeightedGraph = new Map();
    clique(graph, ["a1", "a2", "a3", "a4"]);
    clique(graph, ["b1", "b2", "b3", "b4"]);
    addUndirectedEdge(graph, "a1", "b1", 1);

    const { communities, modularity } = louvain(graph);

    const ca = communities.get("a1");
    expect(communities.get("a2")).toBe(ca);
    expect(communities.get("a3")).toBe(ca);
    expect(communities.get("a4")).toBe(ca);

    const cb = communities.get("b1");
    expect(communities.get("b2")).toBe(cb);
    expect(communities.get("b3")).toBe(cb);
    expect(communities.get("b4")).toBe(cb);

    expect(ca).not.toBe(cb);
    expect(modularity).toBeGreaterThan(0.3);
  });

  it("finds three communities in a ring of cliques", () => {
    const graph: WeightedGraph = new Map();
    clique(graph, ["a1", "a2", "a3"]);
    clique(graph, ["b1", "b2", "b3"]);
    clique(graph, ["c1", "c2", "c3"]);
    addUndirectedEdge(graph, "a1", "b1", 1);
    addUndirectedEdge(graph, "b2", "c1", 1);
    addUndirectedEdge(graph, "c2", "a2", 1);

    const { communities } = louvain(graph);
    const labels = new Set(communities.values());
    expect(labels.size).toBe(3);
    expect(communities.get("a1")).toBe(communities.get("a3"));
    expect(communities.get("b1")).toBe(communities.get("b3"));
    expect(communities.get("c1")).toBe(communities.get("c3"));
  });

  it("respects edge weights: node joins the heavier side", () => {
    const graph: WeightedGraph = new Map();
    clique(graph, ["a1", "a2", "a3"], 5);
    clique(graph, ["b1", "b2", "b3"], 5);
    // "x" weakly tied to a-clique, strongly to b-clique
    addUndirectedEdge(graph, "x", "a1", 1);
    addUndirectedEdge(graph, "x", "b1", 10);
    addUndirectedEdge(graph, "x", "b2", 10);

    const { communities } = louvain(graph);
    expect(communities.get("x")).toBe(communities.get("b1"));
    expect(communities.get("x")).not.toBe(communities.get("a1"));
  });

  it("is deterministic across runs", () => {
    const graph: WeightedGraph = new Map();
    clique(graph, ["a1", "a2", "a3", "a4"]);
    clique(graph, ["b1", "b2", "b3"]);
    addUndirectedEdge(graph, "a1", "b1", 2);
    addUndirectedEdge(graph, "a4", "b3", 1);

    const r1 = louvain(graph);
    const r2 = louvain(graph);
    expect([...r1.communities.entries()]).toEqual([...r2.communities.entries()]);
    expect(r1.modularity).toBe(r2.modularity);
  });

  it("never returns a disconnected community", () => {
    // Star-ish graph engineered so naive Louvain may group distant nodes;
    // after the connectivity post-pass every community must be connected.
    const graph: WeightedGraph = new Map();
    clique(graph, ["a1", "a2", "a3"]);
    clique(graph, ["b1", "b2", "b3"]);
    addUndirectedEdge(graph, "a1", "hub", 1);
    addUndirectedEdge(graph, "b1", "hub", 1);
    addUndirectedEdge(graph, "lone1", "lone2", 1);

    const { communities } = louvain(graph);

    // verify connectivity of each community by BFS
    const byCommunity = new Map<number, string[]>();
    for (const [node, c] of communities) {
      byCommunity.set(c, [...(byCommunity.get(c) ?? []), node]);
    }
    for (const members of byCommunity.values()) {
      const memberSet = new Set(members);
      const visited = new Set<string>([members[0]]);
      const queue = [members[0]];
      while (queue.length) {
        const n = queue.pop()!;
        for (const nb of graph.get(n)?.keys() ?? []) {
          if (memberSet.has(nb) && !visited.has(nb)) {
            visited.add(nb);
            queue.push(nb);
          }
        }
      }
      expect(visited.size).toBe(members.length);
    }
  });
});

describe("computeModularity", () => {
  it("computes known value for two disjoint triangles", () => {
    // Two disjoint K3: m=6. Perfect partition:
    // per community: in=6 (2×3 intra), tot=6 → Q = 2×(6/12 − (6/12)²) = 0.5
    const graph: WeightedGraph = new Map();
    clique(graph, ["a1", "a2", "a3"]);
    clique(graph, ["b1", "b2", "b3"]);
    const partition = new Map<string, number>([
      ["a1", 0], ["a2", 0], ["a3", 0],
      ["b1", 1], ["b2", 1], ["b3", 1],
    ]);
    expect(computeModularity(graph, partition)).toBeCloseTo(0.5, 10);
  });

  it("gives 0 for everything in one community", () => {
    const graph: WeightedGraph = new Map();
    clique(graph, ["a", "b", "c"]);
    const partition = new Map<string, number>([["a", 0], ["b", 0], ["c", 0]]);
    expect(computeModularity(graph, partition)).toBeCloseTo(0, 10);
  });

  it("treats missing nodes as singletons", () => {
    const graph: WeightedGraph = new Map();
    clique(graph, ["a", "b", "c"]);
    clique(graph, ["d", "e", "f"]);
    // only a/b/c assigned; d/e/f become singletons → worse than full partition
    const partial = new Map<string, number>([["a", 0], ["b", 0], ["c", 0]]);
    const full = new Map<string, number>([
      ["a", 0], ["b", 0], ["c", 0],
      ["d", 1], ["e", 1], ["f", 1],
    ]);
    expect(computeModularity(graph, partial)).toBeLessThan(
      computeModularity(graph, full),
    );
  });

  it("supports string community labels", () => {
    const graph: WeightedGraph = new Map();
    clique(graph, ["a1", "a2", "a3"]);
    clique(graph, ["b1", "b2", "b3"]);
    const partition = new Map<string, string>([
      ["a1", "x"], ["a2", "x"], ["a3", "x"],
      ["b1", "y"], ["b2", "y"], ["b3", "y"],
    ]);
    expect(computeModularity(graph, partition)).toBeCloseTo(0.5, 10);
  });

  it("louvain reported modularity matches computeModularity", () => {
    const graph: WeightedGraph = new Map();
    clique(graph, ["a1", "a2", "a3", "a4"]);
    clique(graph, ["b1", "b2", "b3"]);
    addUndirectedEdge(graph, "a1", "b1", 1);
    const { communities, modularity } = louvain(graph);
    expect(modularity).toBeCloseTo(computeModularity(graph, communities), 10);
  });
});
