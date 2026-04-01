/* ── Tier types ── */
export type NodeTier = "hub" | "node" | "edge";
export const DEFAULT_TIER: NodeTier = "edge";

export interface TieredNode {
  id: string;
  tier: NodeTier;
  influenceScore: number;
}

/**
 * Assign tier based on influence rank.
 * Hub: top 10, Node: next 40, Edge: rest
 */
export function assignTiers(
  nodes: { id: string; influenceScore: number }[],
): Map<string, NodeTier> {
  const sorted = [...nodes].sort(
    (a, b) => b.influenceScore - a.influenceScore,
  );
  const map = new Map<string, NodeTier>();
  sorted.forEach((n, i) => {
    if (i < 10) map.set(n.id, "hub");
    else if (i < 50) map.set(n.id, "node");
    else map.set(n.id, "edge");
  });
  return map;
}

/* ── Score helpers ── */

export function influenceToSize(score: number): number {
  return Math.max(2, Math.min(20, 2 + Math.log1p(score) * 3));
}

export function influenceToColor(score: number, baseColor?: string): string {
  if (baseColor) return baseColor;
  // Warm-to-cool gradient: low score → warm amber, high score → cool white
  const t = Math.min(1, score / 100);
  const r = Math.round(180 + t * 75);  // 180→255
  const g = Math.round(140 + t * 95);  // 140→235
  const b = Math.round(100 + t * 155);  // 100→255
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/**
 * Adjust color brightness by tier so nodes within the same cluster
 * are visually distinguishable beyond just size.
 *
 * Hub: +30% lighter, Node: unchanged, Edge: -35% darker
 */
export function tierBrightness(hexColor: string, tier: NodeTier): string {
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);

  let factor: number;
  switch (tier) {
    case "hub":  factor = 1.3;  break;
    case "node": factor = 1.0;  break;
    case "edge": factor = 0.65; break;
  }

  const clamp = (v: number) => Math.min(255, Math.round(v * factor));
  return `#${clamp(r).toString(16).padStart(2, "0")}${clamp(g).toString(16).padStart(2, "0")}${clamp(b).toString(16).padStart(2, "0")}`;
}

/* ── Edge active helpers ── */

export interface EdgeActiveContext {
  /** Set of node IDs connected to the hovered/selected node (includes the node itself) */
  connectedSet: Set<string> | null;
  /** The node ID that is currently active (selected or hovered) */
  activeNodeId: string | null;
  /** Set of node IDs belonging to the selected cluster */
  clusterMemberSet: Set<string> | null;
}

export interface EdgeActiveResult {
  isActive: boolean;
  isClusterEdge: boolean;
}

/**
 * Determine whether a link between srcId and tgtId should be visible,
 * and whether it's a cluster-level edge or node-level edge.
 */
export function isEdgeActive(
  srcId: string,
  tgtId: string,
  ctx: EdgeActiveContext,
): EdgeActiveResult {
  const { connectedSet, activeNodeId, clusterMemberSet } = ctx;

  const isNodeActive =
    connectedSet !== null &&
    activeNodeId !== null &&
    (srcId === activeNodeId || tgtId === activeNodeId) &&
    connectedSet.has(srcId) &&
    connectedSet.has(tgtId);

  const isClusterEdge =
    !isNodeActive &&
    clusterMemberSet !== null &&
    clusterMemberSet.has(srcId) &&
    clusterMemberSet.has(tgtId);

  return { isActive: isNodeActive || isClusterEdge, isClusterEdge };
}

/**
 * Determine whether a node should be highlighted given the current selection context.
 * Returns true if the node should be at full opacity, false if it should be dimmed.
 */
export function isNodeHighlighted(
  nodeId: string,
  clusterMemberSet: Set<string> | null,
): boolean {
  if (!clusterMemberSet) return true;
  return clusterMemberSet.has(nodeId);
}

/* ── Pulse helpers ── */

/**
 * Returns pulse period in seconds based on how recently a node posted.
 * Recent = fast pulse (1s), old = slow (5s), >2h = 0 (static).
 */
export function pulsePeriod(lastPostTimeSec: number, nowSec: number): number {
  const elapsed = nowSec - lastPostTimeSec;
  if (elapsed > 7200) return 0; // >2h → static
  // Lerp: 0s→1s period, 7200s→5s period
  return 1 + (elapsed / 7200) * 4;
}
