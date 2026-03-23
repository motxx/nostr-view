export interface GraphNode {
  id: string; // pubkey
  name?: string;
  picture?: string;
  influenceScore: number;
  clusterId?: string;
  noteCount: number;
  followerCount: number;
  reactionCount: number;
  repostCount: number;
  // Position managed by force-graph
  x?: number;
  y?: number;
  z?: number;
  fx?: number;
  fy?: number;
  fz?: number;
}
