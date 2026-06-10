export type EdgeType =
  | "follow"
  | "reaction"
  | "repost"
  | "reply"
  | "mention"
  | "quote"
  | "zap";

export interface GraphEdge {
  source: string; // pubkey
  target: string; // pubkey
  type: EdgeType;
  weight: number;
}
