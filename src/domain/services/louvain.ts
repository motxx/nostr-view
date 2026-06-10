/**
 * Louvain community detection.
 *
 * Reference: Blondel, Guillaume, Lambiotte & Lefebvre (2008),
 * "Fast unfolding of communities in large networks",
 * J. Stat. Mech. P10008. Modularity: Newman & Girvan (2004).
 *
 * Greedy modularity optimization in two repeated phases:
 *  1. Local moving — each node joins the neighbor community with the
 *     highest modularity gain.
 *  2. Aggregation — communities collapse into super-nodes; repeat.
 *
 * This implementation is deterministic: nodes are visited in sorted
 * order and ties break toward the smallest community id, so the same
 * input always yields the same partition (predictable results, stable
 * cluster identity across recomputes).
 */

/** Undirected weighted adjacency. Must be symmetric: g[a][b] === g[b][a]. */
export type WeightedGraph = Map<string, Map<string, number>>;

export interface LouvainResult {
  /** node id → dense community index (0-based, ordered by first appearance) */
  communities: Map<string, number>;
  modularity: number;
}

export function addUndirectedEdge(
  graph: WeightedGraph,
  a: string,
  b: string,
  weight: number,
): void {
  if (a === b) return;
  let na = graph.get(a);
  if (!na) {
    na = new Map();
    graph.set(a, na);
  }
  let nb = graph.get(b);
  if (!nb) {
    nb = new Map();
    graph.set(b, nb);
  }
  na.set(b, (na.get(b) ?? 0) + weight);
  nb.set(a, (nb.get(a) ?? 0) + weight);
}

/** Internal flat representation of one aggregation level. */
interface LevelGraph {
  n: number;
  /** CSR-like adjacency: neighbors[i] = [nodeIndex, weight][] (no self-loops) */
  neighbors: [number, number][][];
  /** self-loop weight per node (counted once; contributes 2w to degree) */
  selfLoops: number[];
  /** weighted degree per node: sum of incident weights + 2 * selfLoop */
  degrees: number[];
  /** total edge weight m (each undirected edge once, self-loops once) */
  m: number;
}

function buildLevel(
  nodeIds: string[],
  graph: WeightedGraph,
): { level: LevelGraph; indexOf: Map<string, number> } {
  const indexOf = new Map<string, number>();
  nodeIds.forEach((id, i) => indexOf.set(id, i));

  const n = nodeIds.length;
  const neighbors: [number, number][][] = Array.from({ length: n }, () => []);
  const selfLoops = new Array<number>(n).fill(0);
  const degrees = new Array<number>(n).fill(0);
  let m = 0;

  for (let i = 0; i < n; i++) {
    const adj = graph.get(nodeIds[i]);
    if (!adj) continue;
    for (const [other, w] of adj) {
      const j = indexOf.get(other);
      if (j === undefined) continue;
      if (j === i) continue;
      neighbors[i].push([j, w]);
      degrees[i] += w;
      if (i < j) m += w;
    }
  }
  return { level: { n, neighbors, selfLoops, degrees, m }, indexOf };
}

/**
 * One level of local moving. Mutates nothing; returns the community
 * assignment per node index and whether any node moved.
 */
function localMoving(
  level: LevelGraph,
  resolution: number,
): { community: number[]; improved: boolean } {
  const { n, neighbors, selfLoops, degrees, m } = level;
  const community = Array.from({ length: n }, (_, i) => i);
  // tot[c] = sum of degrees of nodes in community c
  const tot = degrees.slice();
  if (m === 0) return { community, improved: false };

  const twoM = 2 * m;
  let improved = false;
  let moved = true;
  let guard = 0;

  while (moved && guard < 100) {
    moved = false;
    guard++;
    for (let i = 0; i < n; i++) {
      const own = community[i];
      const ki = degrees[i] + 2 * selfLoops[i];

      // Sum of edge weights from i to each neighbor community
      const linksTo = new Map<number, number>();
      for (const [j, w] of neighbors[i]) {
        const c = community[j];
        linksTo.set(c, (linksTo.get(c) ?? 0) + w);
      }

      // Remove i from its community
      tot[own] -= ki;

      // Best community = argmax of k_i,in(C) - γ·k_i·tot(C)/2m
      // (standard Louvain gain; constant terms dropped)
      let bestC = own;
      let bestGain = (linksTo.get(own) ?? 0) - (resolution * ki * tot[own]) / twoM;
      const candidates = [...linksTo.keys()].sort((a, b) => a - b);
      for (const c of candidates) {
        if (c === own) continue;
        const gain = linksTo.get(c)! - (resolution * ki * tot[c]) / twoM;
        if (gain > bestGain + 1e-12) {
          bestGain = gain;
          bestC = c;
        }
      }

      tot[bestC] += ki;
      if (bestC !== own) {
        community[i] = bestC;
        moved = true;
        improved = true;
      }
    }
  }
  return { community, improved };
}

/** Renumber community labels to dense 0..k-1 in order of first appearance. */
function renumber(community: number[]): { dense: number[]; count: number } {
  const map = new Map<number, number>();
  const dense = new Array<number>(community.length);
  for (let i = 0; i < community.length; i++) {
    let d = map.get(community[i]);
    if (d === undefined) {
      d = map.size;
      map.set(community[i], d);
    }
    dense[i] = d;
  }
  return { dense, count: map.size };
}

function aggregate(level: LevelGraph, dense: number[], count: number): LevelGraph {
  const neighbors: [number, number][][] = Array.from({ length: count }, () => []);
  const selfLoops = new Array<number>(count).fill(0);
  const degrees = new Array<number>(count).fill(0);
  const edgeAcc = new Map<number, Map<number, number>>();

  for (let i = 0; i < level.n; i++) {
    const ci = dense[i];
    selfLoops[ci] += level.selfLoops[i];
    for (const [j, w] of level.neighbors[i]) {
      const cj = dense[j];
      if (ci === cj) {
        if (i < j) selfLoops[ci] += w; // count each intra edge once
      } else {
        let row = edgeAcc.get(ci);
        if (!row) {
          row = new Map();
          edgeAcc.set(ci, row);
        }
        row.set(cj, (row.get(cj) ?? 0) + w);
      }
    }
  }

  let m = 0;
  for (const [ci, row] of edgeAcc) {
    for (const [cj, w] of row) {
      neighbors[ci].push([cj, w]);
      degrees[ci] += w;
      if (ci < cj) m += w;
    }
  }
  for (let c = 0; c < count; c++) m += selfLoops[c];
  return { n: count, neighbors, selfLoops, degrees, m };
}

function levelModularity(
  level: LevelGraph,
  community: number[],
  resolution: number,
): number {
  const { n, neighbors, selfLoops, degrees, m } = level;
  if (m === 0) return 0;
  const twoM = 2 * m;

  const inW = new Map<number, number>(); // Σ A_ij over i,j in c (directed double count)
  const totW = new Map<number, number>();
  for (let i = 0; i < n; i++) {
    const c = community[i];
    totW.set(c, (totW.get(c) ?? 0) + degrees[i] + 2 * selfLoops[i]);
    inW.set(c, (inW.get(c) ?? 0) + 2 * selfLoops[i]);
    for (const [j, w] of neighbors[i]) {
      if (community[j] === c) inW.set(c, (inW.get(c) ?? 0) + w);
    }
  }

  let q = 0;
  for (const [c, inC] of inW) {
    const totC = totW.get(c) ?? 0;
    q += inC / twoM - resolution * (totC / twoM) ** 2;
  }
  return q;
}

/**
 * Split communities that are internally disconnected into their connected
 * components. Louvain can produce arbitrarily badly-connected (even
 * disconnected) communities — the defect Leiden fixes (Traag, Waltman &
 * van Eck 2019, "From Louvain to Leiden"). Splitting a disconnected
 * community strictly never decreases modularity (intra-edges are
 * unchanged, Σtot² shrinks), so this post-pass is always safe.
 */
function splitDisconnectedCommunities(
  graph: WeightedGraph,
  nodeIds: string[],
  communities: Map<string, number>,
): Map<string, number> {
  const byCommunity = new Map<number, string[]>();
  for (const id of nodeIds) {
    const c = communities.get(id)!;
    let arr = byCommunity.get(c);
    if (!arr) {
      arr = [];
      byCommunity.set(c, arr);
    }
    arr.push(id);
  }

  const result = new Map<string, number>();
  let next = 0;
  const sortedGroups = [...byCommunity.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, members]) => members);
  for (const members of sortedGroups) {
    const memberSet = new Set(members);
    const visited = new Set<string>();
    for (const start of members) {
      if (visited.has(start)) continue;
      const componentId = next++;
      const queue = [start];
      visited.add(start);
      while (queue.length > 0) {
        const node = queue.pop()!;
        result.set(node, componentId);
        const adj = graph.get(node);
        if (!adj) continue;
        for (const neighbor of adj.keys()) {
          if (memberSet.has(neighbor) && !visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        }
      }
    }
  }
  return result;
}

/**
 * Run Louvain on an undirected weighted graph.
 * Nodes with no edges each form their own singleton community.
 */
export function louvain(
  graph: WeightedGraph,
  resolution: number = 1,
): LouvainResult {
  const nodeIds = [...graph.keys()].sort();
  if (nodeIds.length === 0) {
    return { communities: new Map(), modularity: 0 };
  }

  let { level } = buildLevel(nodeIds, graph);
  // membership[i] = current community of original node i (as index into level)
  let membership = Array.from({ length: nodeIds.length }, (_, i) => i);

  for (let iter = 0; iter < 50; iter++) {
    const { community, improved } = localMoving(level, resolution);
    const { dense, count } = renumber(community);
    membership = membership.map((c) => dense[c]);
    if (!improved || count === level.n) break;
    level = aggregate(level, dense, count);
  }

  const { dense: finalDense } = renumber(membership);
  let communities = new Map<string, number>();
  nodeIds.forEach((id, i) => communities.set(id, finalDense[i]));

  communities = splitDisconnectedCommunities(graph, nodeIds, communities);

  return {
    communities,
    modularity: computeModularity(graph, communities, resolution),
  };
}

/**
 * Modularity Q of an arbitrary partition (Newman & Girvan 2004).
 * Nodes present in the graph but missing from the partition are treated
 * as singleton communities.
 */
export function computeModularity(
  graph: WeightedGraph,
  partition: Map<string, number | string>,
  resolution: number = 1,
): number {
  const nodeIds = [...graph.keys()].sort();
  const { level, indexOf } = buildLevel(nodeIds, graph);
  if (level.m === 0) return 0;

  const community = new Array<number>(nodeIds.length);
  const labelToIdx = new Map<number | string, number>();
  let next = 0;
  for (const id of nodeIds) {
    const label = partition.get(id);
    if (label === undefined) {
      community[indexOf.get(id)!] = next++;
    } else {
      let idx = labelToIdx.get(label);
      if (idx === undefined) {
        idx = next++;
        labelToIdx.set(label, idx);
      }
      community[indexOf.get(id)!] = idx;
    }
  }
  return levelModularity(level, community, resolution);
}
