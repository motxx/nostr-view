import type { NostrEvent } from "@/domain/entities/nostr-event";
import type { Cluster } from "@/domain/entities/cluster";
import { NOSTR_KIND } from "@/lib/nostr-kinds";
import { calculateEngagement } from "./engagement";
import { rankClusterHashtags } from "./cluster-labeling";

/**
 * Engagement segmentation — the ad industry's RFM method (Hughes 1994;
 * quantile-based scoring is the documented standard) adapted to social:
 *
 *   R (recency)    = timestamp of the user's latest note
 *   F (frequency)  = number of notes published
 *   E (engagement) = engagement received (replaces Monetary):
 *                    followers + reactions·0.5 + reposts·2 — the same
 *                    weighting as the app's influence score
 *
 * Each dimension is scored 1–5 by population quantile (quintiles, the
 * industry default) — population-relative, no absolute thresholds, so the
 * segmentation adapts to whatever slice of the network is loaded.
 * Segments follow the standard RFM grid (Champions / Loyal / At Risk /
 * Hibernating …), collapsed to six tiers that read well in the UI.
 */

interface SegmentDef {
  id: string;
  label: string;
  tagline: string;
  color: string;
  /** evaluated in order; first match wins */
  matches: (r: number, fe: number) => boolean;
}

const SEGMENTS: SegmentDef[] = [
  {
    id: "engagement-champions",
    label: "Champions",
    tagline: "Posting now and drawing the most engagement",
    color: "#ffa726", // warm gold — most valuable tier
    matches: (r, fe) => r >= 4 && fe >= 4,
  },
  {
    id: "engagement-loyal",
    label: "Loyal Voices",
    tagline: "Steady regulars who post often and get responses",
    color: "#66bb6a",
    matches: (r, fe) => r >= 3 && fe >= 3,
  },
  {
    id: "engagement-rising",
    label: "Rising Stars",
    tagline: "Fresh activity, engagement still building",
    color: "#26c6da",
    matches: (r, fe) => r >= 4 && fe < 3,
  },
  {
    id: "engagement-at-risk",
    label: "At Risk",
    tagline: "Used to draw engagement, quiet lately",
    color: "#ef5350", // valuable but going quiet
    matches: (r, fe) => r <= 2 && fe >= 3,
  },
  {
    id: "engagement-hibernating",
    label: "Hibernating",
    tagline: "Little recent activity or engagement",
    color: "#78909c",
    matches: (r, fe) => r <= 2 && fe < 3,
  },
  {
    id: "engagement-casual",
    label: "Casual",
    tagline: "Occasional posters in the middle of the pack",
    color: "#4fc3f7",
    matches: () => true,
  },
];

/**
 * Quintile scores 1–5 (5 = best) by ascending rank over the population.
 * Equal values share the same score (standard tie handling: rank of the
 * first occurrence), keeping the result order-independent.
 */
export function quintileScores(values: Map<string, number>): Map<string, number> {
  const entries = [...values.entries()].sort(
    (a, b) => a[1] - b[1] || a[0].localeCompare(b[0]),
  );
  const n = entries.length;
  const scores = new Map<string, number>();
  let firstRankOfValue = 0;
  for (let i = 0; i < n; i++) {
    if (i > 0 && entries[i][1] !== entries[i - 1][1]) firstRankOfValue = i;
    const score = Math.min(5, 1 + Math.floor((5 * firstRankOfValue) / n));
    scores.set(entries[i][0], score);
  }
  return scores;
}

export function detectEngagementClusters(
  events: NostrEvent[],
  minClusterSize: number = 3,
  maxClusters: number = 10,
): Cluster[] {
  const recency = new Map<string, number>();
  const frequency = new Map<string, number>();
  for (const event of events) {
    if (event.kind !== NOSTR_KIND.TEXT_NOTE) continue;
    const pk = event.pubkey;
    recency.set(pk, Math.max(recency.get(pk) ?? 0, event.created_at));
    frequency.set(pk, (frequency.get(pk) ?? 0) + 1);
  }
  if (recency.size === 0) return [];

  // E = engagement received (NIP-aware, intent-weighted, spam-resistant
  // — see engagement.ts). Replaces the old followers+reactions formula.
  const { scores } = calculateEngagement(events);
  const engagement = new Map<string, number>();
  for (const pk of recency.keys()) {
    engagement.set(pk, scores[pk] ?? 0);
  }

  const rScores = quintileScores(recency);
  const fScores = quintileScores(frequency);
  const eScores = quintileScores(engagement);

  const segmentMembers = new Map<string, Set<string>>();
  for (const pk of recency.keys()) {
    const r = rScores.get(pk)!;
    const fe = (fScores.get(pk)! + eScores.get(pk)!) / 2;
    const segment = SEGMENTS.find((s) => s.matches(r, fe))!;
    let members = segmentMembers.get(segment.id);
    if (!members) {
      members = new Set();
      segmentMembers.set(segment.id, members);
    }
    members.add(pk);
  }

  const kept = SEGMENTS.filter((s) => {
    const members = segmentMembers.get(s.id);
    return members && members.size >= minClusterSize;
  }).slice(0, maxClusters);

  // Decorative context tags: what each tier talks about (c-TF-IDF ranked)
  const clusterMembers = new Map<string, Set<string>>();
  for (const s of kept) clusterMembers.set(s.id, segmentMembers.get(s.id)!);
  const rankedTags = rankClusterHashtags(clusterMembers, events);

  return kept.map((s) => ({
    id: s.id,
    label: s.label,
    tagline: s.tagline,
    hashtags: (rankedTags.get(s.id) ?? []).slice(0, 10),
    memberPubkeys: segmentMembers.get(s.id)!,
    color: s.color,
    labelLocked: true,
  }));
}
