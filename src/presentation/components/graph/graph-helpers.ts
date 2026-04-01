import { useGraphStore } from "@/store/graph-store";

export function buildConnectedSet(hoveredId: string): Set<string> {
  const set = new Set<string>([hoveredId]);
  for (const e of useGraphStore.getState().edges) {
    if (e.source === hoveredId) set.add(e.target);
    if (e.target === hoveredId) set.add(e.source);
  }
  return set;
}

export function buildClusterMemberSet(clusterId: string): Set<string> | null {
  const cluster = useGraphStore.getState().clusters.find((c) => c.id === clusterId);
  if (!cluster) return null;
  return new Set(cluster.memberPubkeys);
}
