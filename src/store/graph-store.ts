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
  updateClusterLabels: (labelMap: Map<string, string>) => void;
  clear: () => void;
}

export const useGraphStore = create<GraphStore>((set) => ({
  nodes: [],
  edges: [],
  clusters: [],
  bridges: new Map(),
  explorationMap: null,
  lastUpdated: 0,

  setGraphData: (nodes, edges) =>
    set({ nodes, edges, lastUpdated: Date.now() }),

  setClusters: (clusters) => set({ clusters }),
  setBridges: (bridges) => set({ bridges }),
  setExplorationMap: (map) => set({ explorationMap: map }),

  setAll: (data) => set({ ...data, lastUpdated: Date.now() }),

  updateClusterLabels: (labelMap) =>
    set((state) => ({
      clusters: state.clusters.map((c) => {
        const newLabel = labelMap.get(c.id);
        return newLabel ? { ...c, label: newLabel } : c;
      }),
    })),

  clear: () =>
    set({
      nodes: [],
      edges: [],
      clusters: [],
      bridges: new Map(),
      explorationMap: null,
      lastUpdated: 0,
    }),
}));
