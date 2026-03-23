import { create } from "zustand";
import type { GraphNode } from "@/domain/entities/graph-node";
import type { GraphEdge } from "@/domain/entities/graph-edge";
import type { Cluster } from "@/domain/entities/cluster";

interface GraphStore {
  nodes: GraphNode[];
  edges: GraphEdge[];
  clusters: Cluster[];
  lastUpdated: number;

  setGraphData: (nodes: GraphNode[], edges: GraphEdge[]) => void;
  setClusters: (clusters: Cluster[]) => void;
  clear: () => void;
}

export const useGraphStore = create<GraphStore>((set) => ({
  nodes: [],
  edges: [],
  clusters: [],
  lastUpdated: 0,

  setGraphData: (nodes, edges) =>
    set({ nodes, edges, lastUpdated: Date.now() }),

  setClusters: (clusters) => set({ clusters }),

  clear: () => set({ nodes: [], edges: [], clusters: [], lastUpdated: 0 }),
}));
