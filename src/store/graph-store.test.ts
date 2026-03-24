import { describe, it, expect, beforeEach } from "vitest";
import { useGraphStore } from "./graph-store";
import type { GraphNode } from "@/domain/entities/graph-node";
import type { GraphEdge } from "@/domain/entities/graph-edge";
import type { Cluster } from "@/domain/entities/cluster";

describe("graph-store", () => {
  beforeEach(() => {
    useGraphStore.getState().clear();
  });

  describe("setGraphData", () => {
    it("sets nodes and edges", () => {
      const nodes: GraphNode[] = [
        {
          id: "alice",
          influenceScore: 10,
          noteCount: 5,
          followerCount: 0,
          reactionCount: 0,
          repostCount: 0,
        },
      ];
      const edges: GraphEdge[] = [
        { source: "alice", target: "bob", type: "follow", weight: 1 },
      ];
      useGraphStore.getState().setGraphData(nodes, edges);
      expect(useGraphStore.getState().nodes).toHaveLength(1);
      expect(useGraphStore.getState().edges).toHaveLength(1);
      expect(useGraphStore.getState().lastUpdated).toBeGreaterThan(0);
    });
  });

  describe("setClusters", () => {
    it("sets clusters", () => {
      const clusters: Cluster[] = [
        {
          id: "c1",
          label: "bitcoin",
          hashtags: ["bitcoin"],
          memberPubkeys: new Set(["alice"]),
          color: "#ff0000",
        },
      ];
      useGraphStore.getState().setClusters(clusters);
      expect(useGraphStore.getState().clusters).toHaveLength(1);
      expect(useGraphStore.getState().clusters[0].label).toBe("bitcoin");
    });
  });

  describe("clear", () => {
    it("resets all state", () => {
      useGraphStore.getState().setGraphData(
        [{ id: "a", influenceScore: 0, noteCount: 0, followerCount: 0, reactionCount: 0, repostCount: 0 }],
        [],
      );
      useGraphStore.getState().clear();
      expect(useGraphStore.getState().nodes).toHaveLength(0);
      expect(useGraphStore.getState().edges).toHaveLength(0);
      expect(useGraphStore.getState().lastUpdated).toBe(0);
    });
  });
});
