import { describe, it, expect } from "vitest";
import {
  forceClusterCore,
  computeCorePull,
  type CoreForceNode,
} from "./cluster-core-force";

describe("computeCorePull", () => {
  it("ranks within-cluster engagement to 0..1 percentiles", () => {
    const nodes = [
      { id: "rim", clusterId: "c1", clusterEngagement: 0 },
      { id: "mid", clusterId: "c1", clusterEngagement: 5 },
      { id: "core", clusterId: "c1", clusterEngagement: 20 },
    ];
    const pull = computeCorePull(nodes);
    expect(pull.get("rim")).toBe(0);
    expect(pull.get("mid")).toBe(0.5);
    expect(pull.get("core")).toBe(1);
  });

  it("ranks per cluster independently", () => {
    const nodes = [
      { id: "a1", clusterId: "c1", clusterEngagement: 1 },
      { id: "a2", clusterId: "c1", clusterEngagement: 100 },
      { id: "b1", clusterId: "c2", clusterEngagement: 2 },
      { id: "b2", clusterId: "c2", clusterEngagement: 3 },
    ];
    const pull = computeCorePull(nodes);
    expect(pull.get("a2")).toBe(1);
    expect(pull.get("b2")).toBe(1); // top of its own cluster
  });

  it("gives unclustered nodes no pull and singletons 0.5", () => {
    const nodes = [
      { id: "solo", clusterId: "c1", clusterEngagement: 9 },
      { id: "floating", clusterId: undefined, clusterEngagement: 99 },
    ];
    const pull = computeCorePull(nodes);
    expect(pull.get("solo")).toBe(0.5);
    expect(pull.has("floating")).toBe(false);
  });

  it("equal engagement shares the same pull", () => {
    const nodes = [
      { id: "a", clusterId: "c1", clusterEngagement: 1 },
      { id: "b", clusterId: "c1", clusterEngagement: 1 },
      { id: "c", clusterId: "c1", clusterEngagement: 2 },
    ];
    const pull = computeCorePull(nodes);
    expect(pull.get("a")).toBe(pull.get("b"));
    expect(pull.get("c")).toBe(1);
  });
});

describe("forceClusterCore", () => {
  it("pulls high-corePull nodes toward the cluster centroid harder", () => {
    const nodes: CoreForceNode[] = [
      { clusterId: "c1", corePull: 1, x: 100, y: 0, z: 0, vx: 0, vy: 0, vz: 0 },
      { clusterId: "c1", corePull: 0.1, x: -100, y: 0, z: 0, vx: 0, vy: 0, vz: 0 },
      { clusterId: "c1", corePull: 0, x: 0, y: 50, z: 0, vx: 0, vy: 0, vz: 0 },
    ];
    const force = forceClusterCore(0.2);
    force.initialize(nodes);
    force(1); // alpha = 1

    // centroid = (0, 16.67, 0); hub at x=100 must accelerate toward -x
    expect(nodes[0].vx!).toBeLessThan(0);
    // rim node with low pull moves much less
    expect(Math.abs(nodes[1].vx!)).toBeLessThan(Math.abs(nodes[0].vx!));
    // zero pull → untouched
    expect(nodes[2].vx).toBe(0);
    expect(nodes[2].vy).toBe(0);
  });

  it("ignores unclustered nodes and single-member clusters", () => {
    const nodes: CoreForceNode[] = [
      { clusterId: undefined, corePull: 1, x: 10, y: 0, z: 0, vx: 0, vy: 0, vz: 0 },
      { clusterId: "solo", corePull: 1, x: 20, y: 0, z: 0, vx: 0, vy: 0, vz: 0 },
    ];
    const force = forceClusterCore(0.2);
    force.initialize(nodes);
    force(1);
    expect(nodes[0].vx).toBe(0);
    expect(nodes[1].vx).toBe(0);
  });
});
