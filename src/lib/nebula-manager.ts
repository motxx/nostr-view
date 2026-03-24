import * as THREE from "three";
import type { Cluster } from "@/domain/entities/cluster";
import { createClusterLabelNode } from "./graph-utils";

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

/**
 * Non-React module that reconciles cluster nebulae in a Three.js scene.
 * Call sync() each frame to add/remove/reposition nebulae.
 * Call dispose() on unmount to clean up.
 */
export class NebulaManager {
  private nebulae = new Map<string, THREE.Group>();

  /**
   * Reconcile nebulae with the current cluster list and positions.
   * - Adds new nebulae for new clusters
   * - Removes nebulae for deleted clusters
   * - Updates positions to track member centroids
   */
  sync(
    scene: THREE.Scene,
    clusters: Cluster[],
    liveNodes: NodePosition[],
  ): void {
    const currentIds = new Set(clusters.map((c) => c.id));

    // Remove stale
    for (const [id, obj] of this.nebulae) {
      if (!currentIds.has(id)) {
        scene.remove(obj);
        this.nebulae.delete(id);
      }
    }

    // Add new + update positions
    for (const cluster of clusters) {
      let nebula = this.nebulae.get(cluster.id);
      if (!nebula) {
        nebula = createClusterLabelNode(
          `#${cluster.label}`,
          cluster.color,
          cluster.memberPubkeys.size,
        );
        scene.add(nebula);
        this.nebulae.set(cluster.id, nebula);
      }

      const centroid = computeClusterCentroid(cluster, liveNodes);
      if (centroid) {
        nebula.position.set(centroid.x, centroid.y - 15, centroid.z);
      }
    }
  }

  /** Remove all nebulae from scene. */
  dispose(scene: THREE.Scene): void {
    for (const obj of this.nebulae.values()) {
      scene.remove(obj);
    }
    this.nebulae.clear();
  }

  /** Get the centroid for a specific cluster (for flyToCluster). */
  getCentroid(
    clusterId: string,
    clusters: Cluster[],
    liveNodes: NodePosition[],
  ): { x: number; y: number; z: number } | null {
    const cluster = clusters.find((c) => c.id === clusterId);
    if (!cluster) return null;
    return computeClusterCentroid(cluster, liveNodes);
  }
}
