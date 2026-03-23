export type EdgeType = "follow" | "reaction" | "repost" | "reply";

export interface GraphEdge {
  source: string; // pubkey
  target: string; // pubkey
  type: EdgeType;
  weight: number;
}
