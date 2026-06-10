export interface GraphNode {
  id: string; // pubkey
  name?: string;
  picture?: string;
  /** Engagement received (weighted) + reciprocity — see engagement.ts */
  engagementScore: number;
  /** Engagement received from same-cluster members (centripetal layout) */
  clusterEngagement: number;
  clusterId?: string;
  noteCount: number;
  followerCount: number;
  reactionCount: number;
  repostCount: number;
  replyCount: number;
  zapCount: number;
  reciprocalCount: number;
  // Position managed by force-graph
  x?: number;
  y?: number;
  z?: number;
  fx?: number;
  fy?: number;
  fz?: number;
}
