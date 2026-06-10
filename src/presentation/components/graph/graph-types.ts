import type { SimulationNode, SimulationLink, Simulation } from "d3-force-3d";
import type { NodeTier } from "@/lib/graph-math";

export interface GraphNodeData extends SimulationNode {
  id: string;
  name?: string;
  picture?: string;
  engagementScore: number;
  /** 0..1 within-cluster engagement percentile → centripetal strength */
  corePull: number;
  clusterId?: string;
  clusterColor?: string;
  tier: NodeTier;
  isUnexplored?: boolean;
}

export interface GraphLinkData extends SimulationLink<GraphNodeData> {
  type: string;
  weight: number;
}

export interface SimState {
  sim: Simulation<GraphNodeData>;
  nodes: GraphNodeData[];
  links: GraphLinkData[];
  nodeMap: Map<string, GraphNodeData>;
}
