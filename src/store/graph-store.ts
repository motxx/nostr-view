import { create } from "zustand";
import type { GraphNode } from "@/domain/entities/graph-node";
import type { GraphEdge } from "@/domain/entities/graph-edge";
import type { Cluster } from "@/domain/entities/cluster";
import type { BridgeInfo } from "@/domain/services/cluster-summary";
import type { ExplorationMap } from "@/domain/services/exploration-map";

interface GraphStore {
  nodes: GraphNode[];
  edges: GraphEdge[];
  clusters: Cluster[];
  bridges: Map<string, BridgeInfo[]>;
  explorationMap: ExplorationMap | null;
  lastUpdated: number;
  /** LLM-generated label overrides, keyed by cluster ID. Separate from
   *  clusters so that periodic setAll() doesn't overwrite them. */
  clusterLabelOverrides: Map<string, string>;

  setGraphData: (nodes: GraphNode[], edges: GraphEdge[]) => void;
  setClusters: (clusters: Cluster[]) => void;
  setBridges: (bridges: Map<string, BridgeInfo[]>) => void;
  setExplorationMap: (map: ExplorationMap | null) => void;
  setAll: (data: {
    clusters: Cluster[];
    nodes: GraphNode[];
    edges: GraphEdge[];
    bridges: Map<string, BridgeInfo[]>;
    explorationMap: ExplorationMap | null;
  }) => void;
  setClusterLabelOverrides: (labelMap: Map<string, string>) => void;
  clearClusterLabelOverrides: () => void;
  clear: () => void;
}

export const useGraphStore = create<GraphStore>((set) => ({
  nodes: [],
  edges: [],
  clusters: [],
  bridges: new Map(),
  explorationMap: null,
  lastUpdated: 0,
  clusterLabelOverrides: new Map(),

  setGraphData: (nodes, edges) =>
    set({ nodes, edges, lastUpdated: Date.now() }),

  setClusters: (clusters) => set({ clusters }),
  setBridges: (bridges) => set({ bridges }),
  setExplorationMap: (map) => set({ explorationMap: map }),

  setAll: (data) => set({ ...data, lastUpdated: Date.now() }),

  setClusterLabelOverrides: (labelMap) =>
    set((state) => {
      const merged = new Map(state.clusterLabelOverrides);
      for (const [id, label] of labelMap) merged.set(id, label);
      return { clusterLabelOverrides: merged };
    }),

  clearClusterLabelOverrides: () => set({ clusterLabelOverrides: new Map() }),

  clear: () =>
    set({
      nodes: [],
      edges: [],
      clusters: [],
      bridges: new Map(),
      explorationMap: null,
      clusterLabelOverrides: new Map(),
      lastUpdated: 0,
    }),
}));

