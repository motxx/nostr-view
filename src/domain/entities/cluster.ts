export interface Cluster {
  id: string;
  label: string;
  /** One-line description of what members actually post (channel-guide style) */
  tagline?: string;
  hashtags: string[];
  memberPubkeys: Set<string>;
  color: string;
  /** True when the label is deterministic and final (language, engagement
   *  segments) — skips LLM naming and fingerprints by id. */
  labelLocked?: boolean;
  /** Naming-cache key inherited across recomputes when the community
   *  persists (cluster-identity reconciliation). Overrides the computed
   *  fingerprint so LLM headlines stick while members/tags evolve. */
  fingerprint?: string;
  centerX?: number;
  centerY?: number;
  centerZ?: number;
}

/** LLM-generated display override, cached by clusterFingerprint(). */
export interface ClusterLabelOverride {
  label: string;
  tagline?: string;
}

/** Apply cached LLM names/taglines to clusters at render time. */
export function applyLabelOverrides(
  clusters: Cluster[],
  overrides: Map<string, ClusterLabelOverride>,
): Cluster[] {
  if (overrides.size === 0) return clusters;
  return clusters.map((c) => {
    const override = overrides.get(clusterFingerprint(c));
    return override
      ? { ...c, label: override.label, tagline: override.tagline ?? c.tagline }
      : c;
  });
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
  // Identity inherited from a previous recompute wins (see
  // cluster-identity.ts) — keeps LLM headlines stable while tags evolve.
  if (cluster.fingerprint) return cluster.fingerprint;
  // Locked-label clusters (language, engagement segments) have stable,
  // deterministic ids — hashtags are only decorative context there.
  if (!cluster.labelLocked && cluster.hashtags.length > 0) {
    return [...cluster.hashtags].sort().slice(0, 5).join("+");
  }
  return cluster.id;
}
