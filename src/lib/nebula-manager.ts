import type { Cluster } from "@/domain/entities/cluster";

export interface NodePosition {
  id?: string | number;
  x?: number;
  y?: number;
  z?: number;
  isClusterNode?: boolean;
}

/**
 * Compute cluster centroid from live node positions.
 * Pure function — no store access.
 */
export function computeClusterCentroid(
  cluster: Cluster,
  liveNodes: NodePosition[],
): { x: number; y: number; z: number } | null {
  let x = 0,
    y = 0,
    z = 0,
    count = 0;
  for (const n of liveNodes) {
    if (
      !n.isClusterNode &&
      cluster.memberPubkeys.has(String(n.id)) &&
      n.x !== undefined
    ) {
      x += n.x;
      y += n.y ?? 0;
      z += n.z ?? 0;
      count++;
    }
  }
  return count > 0 ? { x: x / count, y: y / count, z: z / count } : null;
}
