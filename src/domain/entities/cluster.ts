export interface Cluster {
  id: string;
  label: string;
  hashtags: string[];
  memberPubkeys: Set<string>;
  color: string;
  /** True when the label is deterministic and final (language, engagement
   *  segments) — skips LLM naming and fingerprints by id. */
  labelLocked?: boolean;
  centerX?: number;
  centerY?: number;
  centerZ?: number;
}

const CLUSTER_COLORS = [
  "#4fc3f7", // blue - Bitcoin/Lightning
  "#ab47bc", // purple - Privacy
  "#66bb6a", // green - Dev
  "#ffa726", // orange - Art
  "#ef5350", // red - Politics
  "#26c6da", // cyan - Science
  "#ffee58", // yellow - Memes
  "#ec407a", // pink - Music
  "#8d6e63", // brown - Philosophy
  "#78909c", // grey - General
];

export function getClusterColor(index: number): string {
  return CLUSTER_COLORS[index % CLUSTER_COLORS.length];
}

/**
 * Content-based fingerprint for caching LLM-generated labels.
 * Stable across graph recomputes as long as the cluster's top hashtags
 * remain the same, regardless of positional ID shifts.
 */
export function clusterFingerprint(cluster: Cluster): string {
  // Locked-label clusters (language, engagement segments) have stable,
  // deterministic ids — hashtags are only decorative context there.
  if (!cluster.labelLocked && cluster.hashtags.length > 0) {
    return [...cluster.hashtags].sort().slice(0, 5).join("+");
  }
  return cluster.id;
}
