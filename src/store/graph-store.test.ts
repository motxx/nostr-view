import { describe, it, expect, beforeEach } from "vitest";
import { useGraphStore } from "./graph-store";
import type { GraphNode } from "@/domain/entities/graph-node";
import type { GraphEdge } from "@/domain/entities/graph-edge";
import type { Cluster } from "@/domain/entities/cluster";
import type { BridgeInfo } from "@/domain/services/cluster-summary";
import type { ExplorationMap } from "@/domain/services/exploration-map";

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

  describe("setBridges", () => {
    it("sets bridges map", () => {
      const bridges = new Map<string, BridgeInfo[]>([
        [
          "c1",
          [{ targetClusterId: "c2", sharedCount: 3, bridgePubkeys: ["p1", "p2"] }],
        ],
      ]);
      useGraphStore.getState().setBridges(bridges);
      const stored = useGraphStore.getState().bridges;
      expect(stored.get("c1")).toHaveLength(1);
      expect(stored.get("c1")![0].sharedCount).toBe(3);
    });

    it("overwrites previous bridges", () => {
      const first = new Map<string, BridgeInfo[]>([
        ["c1", [{ targetClusterId: "c2", sharedCount: 1, bridgePubkeys: [] }]],
      ]);
      const second = new Map<string, BridgeInfo[]>([
        ["c3", [{ targetClusterId: "c4", sharedCount: 5, bridgePubkeys: ["p1"] }]],
      ]);
      useGraphStore.getState().setBridges(first);
      useGraphStore.getState().setBridges(second);
      const stored = useGraphStore.getState().bridges;
      expect(stored.has("c1")).toBe(false);
      expect(stored.get("c3")![0].sharedCount).toBe(5);
    });
  });

  describe("setExplorationMap", () => {
    it("sets exploration map", () => {
      const map: ExplorationMap = {
        reachability: new Map([["c1", 0], ["c2", 1]]),
        coverage: 1,
        recommendations: [],
      };
      useGraphStore.getState().setExplorationMap(map);
      const stored = useGraphStore.getState().explorationMap;
      expect(stored).not.toBeNull();
      expect(stored!.coverage).toBe(1);
      expect(stored!.reachability.get("c1")).toBe(0);
      expect(stored!.reachability.get("c2")).toBe(1);
    });

    it("can be set to null", () => {
      const map: ExplorationMap = {
        reachability: new Map(),
        coverage: 0,
        recommendations: [],
      };
      useGraphStore.getState().setExplorationMap(map);
      useGraphStore.getState().setExplorationMap(null);
      expect(useGraphStore.getState().explorationMap).toBeNull();
    });

    it("stores recommendations", () => {
      const map: ExplorationMap = {
        reachability: new Map([["c1", 0], ["c2", Infinity]]),
        coverage: 0.5,
        recommendations: [
          { targetClusterId: "c2", viaClusters: ["c1"], bridgePubkey: "p1" },
        ],
      };
      useGraphStore.getState().setExplorationMap(map);
      const stored = useGraphStore.getState().explorationMap!;
      expect(stored.recommendations).toHaveLength(1);
      expect(stored.recommendations[0].bridgePubkey).toBe("p1");
      expect(stored.reachability.get("c2")).toBe(Infinity);
    });
  });

  describe("clusterLabelOverrides", () => {
    const clusters: Cluster[] = [
      { id: "c1", label: "bitcoin", hashtags: ["bitcoin"], memberPubkeys: new Set(["a"]), color: "#f00" },
      { id: "c2", label: "nostr", hashtags: ["nostr"], memberPubkeys: new Set(["b"]), color: "#0f0" },
      { id: "c3", label: "Community 1", hashtags: [], memberPubkeys: new Set(["c"]), color: "#00f" },
    ];

    beforeEach(() => {
      useGraphStore.getState().setClusters(clusters);
    });

    it("setClusterLabelOverrides merges into existing overrides", () => {
      useGraphStore.getState().setClusterLabelOverrides(new Map([["c1", "BTC Maxis"]]));
      useGraphStore.getState().setClusterLabelOverrides(new Map([["c2", "Nostr Devs"]]));
      const overrides = useGraphStore.getState().clusterLabelOverrides;
      expect(overrides.get("c1")).toBe("BTC Maxis");
      expect(overrides.get("c2")).toBe("Nostr Devs");
    });

    it("clearClusterLabelOverrides empties the map", () => {
      useGraphStore.getState().setClusterLabelOverrides(new Map([["c1", "BTC Maxis"]]));
      useGraphStore.getState().clearClusterLabelOverrides();
      expect(useGraphStore.getState().clusterLabelOverrides.size).toBe(0);
    });

    it("setAll does not clear clusterLabelOverrides", () => {
      useGraphStore.getState().setClusterLabelOverrides(new Map([["c1", "BTC Maxis"]]));
      useGraphStore.getState().setAll({
        clusters,
        nodes: [],
        edges: [],
        bridges: new Map(),
        explorationMap: null,
      });
      // Overrides survive setAll — this is the key invariant
      expect(useGraphStore.getState().clusterLabelOverrides.get("c1")).toBe("BTC Maxis");
    });
  });

  describe("label override merging", () => {
    const clusters: Cluster[] = [
      { id: "c1", label: "bitcoin", hashtags: ["bitcoin"], memberPubkeys: new Set(["a"]), color: "#f00" },
      { id: "c2", label: "nostr", hashtags: ["nostr"], memberPubkeys: new Set(["b"]), color: "#0f0" },
    ];

    function applyOverrides(cs: Cluster[], overrides: Map<string, string>): Cluster[] {
      if (overrides.size === 0) return cs;
      return cs.map((c) => {
        const override = overrides.get(c.id);
        return override ? { ...c, label: override } : c;
      });
    }

    it("returns clusters unchanged when no overrides", () => {
      const result = applyOverrides(clusters, new Map());
      expect(result[0].label).toBe("bitcoin");
      expect(result[1].label).toBe("nostr");
      expect(result).toBe(clusters); // same reference
    });

    it("applies overrides to matching cluster IDs", () => {
      const result = applyOverrides(clusters, new Map([["c1", "BTC Maxis"]]));
      expect(result[0].label).toBe("BTC Maxis");
      expect(result[1].label).toBe("nostr");
    });

    it("does not mutate original cluster objects", () => {
      applyOverrides(clusters, new Map([["c1", "BTC Maxis"]]));
      expect(clusters[0].label).toBe("bitcoin");
    });
  });

  describe("clear", () => {
    it("resets all state including overrides", () => {
      useGraphStore.getState().setGraphData(
        [{ id: "a", influenceScore: 0, noteCount: 0, followerCount: 0, reactionCount: 0, repostCount: 0 }],
        [],
      );
      useGraphStore.getState().setBridges(
        new Map([["c1", [{ targetClusterId: "c2", sharedCount: 1, bridgePubkeys: [] }]]]),
      );
      useGraphStore.getState().setExplorationMap({
        reachability: new Map(),
        coverage: 1,
        recommendations: [],
      });
      useGraphStore.getState().setClusterLabelOverrides(new Map([["c1", "Test"]]));
      useGraphStore.getState().clear();
      expect(useGraphStore.getState().nodes).toHaveLength(0);
      expect(useGraphStore.getState().edges).toHaveLength(0);
      expect(useGraphStore.getState().bridges.size).toBe(0);
      expect(useGraphStore.getState().explorationMap).toBeNull();
      expect(useGraphStore.getState().clusterLabelOverrides.size).toBe(0);
      expect(useGraphStore.getState().lastUpdated).toBe(0);
    });
  });
});
