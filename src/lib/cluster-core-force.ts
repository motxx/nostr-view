/**
 * Centripetal cluster-core force for d3-force-3d.
 *
 * Pulls each node toward its cluster's centroid with strength
 * proportional to `corePull` (0..1 = within-cluster engagement
 * percentile). High-engagement members become the nucleus of their
 * nebula; low-engagement members settle on the rim. This encodes the
 * social-graph convention "influencers sit central" without distorting
 * the community layout itself (the pull is toward the own-cluster
 * centroid, not the global center).
 */

export interface CoreForceNode {
  clusterId?: string;
  /** 0..1 — within-cluster engagement percentile */
  corePull: number;
  x?: number;
  y?: number;
  z?: number;
  vx?: number;
  vy?: number;
  vz?: number;
}

interface CentroidAcc {
  x: number;
  y: number;
  z: number;
  n: number;
}

export function forceClusterCore(strength: number = 0.18) {
  let nodes: CoreForceNode[] = [];

  function force(alpha: number) {
    const centroids = new Map<string, CentroidAcc>();
    for (const node of nodes) {
      if (!node.clusterId || node.x === undefined) continue;
      let acc = centroids.get(node.clusterId);
      if (!acc) {
        acc = { x: 0, y: 0, z: 0, n: 0 };
        centroids.set(node.clusterId, acc);
      }
      acc.x += node.x;
      acc.y += node.y ?? 0;
      acc.z += node.z ?? 0;
      acc.n++;
    }

    for (const node of nodes) {
      if (!node.clusterId || node.x === undefined || node.corePull <= 0) continue;
      const acc = centroids.get(node.clusterId);
      if (!acc || acc.n < 2) continue;
      const k = alpha * strength * node.corePull;
      node.vx = (node.vx ?? 0) + (acc.x / acc.n - node.x) * k;
      node.vy = (node.vy ?? 0) + (acc.y / acc.n - (node.y ?? 0)) * k;
      node.vz = (node.vz ?? 0) + (acc.z / acc.n - (node.z ?? 0)) * k;
    }
  }

  force.initialize = (initNodes: CoreForceNode[]) => {
    nodes = initNodes;
  };

  return force;
}

/**
 * Within-cluster engagement percentile (0..1) per node — the corePull
 * input. Computed per cluster: rank by clusterEngagement ascending,
 * equal values share the lower rank. Single-member clusters get 0.5.
 */
export function computeCorePull(
  nodes: { id: string; clusterId?: string; clusterEngagement: number }[],
): Map<string, number> {
  const byCluster = new Map<string, { id: string; v: number }[]>();
  for (const node of nodes) {
    if (!node.clusterId) continue;
    let arr = byCluster.get(node.clusterId);
    if (!arr) {
      arr = [];
      byCluster.set(node.clusterId, arr);
    }
    arr.push({ id: node.id, v: node.clusterEngagement });
  }

  const pull = new Map<string, number>();
  for (const members of byCluster.values()) {
    if (members.length === 1) {
      pull.set(members[0].id, 0.5);
      continue;
    }
    members.sort((a, b) => a.v - b.v || a.id.localeCompare(b.id));
    let firstRankOfValue = 0;
    members.forEach((m, i) => {
      if (i > 0 && m.v !== members[i - 1].v) firstRankOfValue = i;
      pull.set(m.id, firstRankOfValue / (members.length - 1));
    });
  }
  return pull;
}
