import { describe, it, expect } from "vitest";
import { computeClusterCentroid } from "./nebula-manager";
import type { Cluster } from "@/domain/entities/cluster";

describe("computeClusterCentroid", () => {
  const cluster: Cluster = {
    id: "c1",
    label: "test",
    hashtags: [],
    memberPubkeys: new Set(["alice", "bob", "carol"]),
    color: "#ff0000",
  };

  it("computes average position of cluster members", () => {
    const nodes = [
      { id: "alice", x: 10, y: 20, z: 30 },
      { id: "bob", x: 40, y: 50, z: 60 },
      { id: "carol", x: 70, y: 80, z: 90 },
      { id: "dave", x: 100, y: 100, z: 100 }, // not a member
    ];
    const c = computeClusterCentroid(cluster, nodes);
    expect(c).toEqual({ x: 40, y: 50, z: 60 });
  });

  it("excludes cluster nodes from centroid", () => {
    const nodes = [
      { id: "alice", x: 10, y: 20, z: 30 },
      { id: "bob", x: 40, y: 50, z: 60 },
      { id: "carol", x: 70, y: 80, z: 90 },
      { id: "cluster:c1", x: 0, y: 0, z: 0, isClusterNode: true },
    ];
    const c = computeClusterCentroid(cluster, nodes);
    expect(c).toEqual({ x: 40, y: 50, z: 60 });
  });

  it("returns null when no members have positions", () => {
    const nodes = [{ id: "dave", x: 10, y: 20, z: 30 }];
    expect(computeClusterCentroid(cluster, nodes)).toBeNull();
  });

  it("returns null for empty nodes", () => {
    expect(computeClusterCentroid(cluster, [])).toBeNull();
  });

  it("skips members without x coordinate", () => {
    const nodes = [
      { id: "alice", x: undefined, y: 20, z: 30 },
      { id: "bob", x: 40, y: 50, z: 60 },
    ];
    const c = computeClusterCentroid(cluster, nodes);
    expect(c).toEqual({ x: 40, y: 50, z: 60 });
  });
});
