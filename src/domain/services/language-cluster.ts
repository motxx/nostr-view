import type { NostrEvent } from "@/domain/entities/nostr-event";
import { type Cluster, getClusterColor } from "@/domain/entities/cluster";
import { NOSTR_KIND } from "@/lib/nostr-kinds";

const LANG_PATTERNS: [string, RegExp][] = [
  ["Japanese", /[\u3040-\u309f\u30a0-\u30ff]/],
  ["Korean", /[\uac00-\ud7af\u1100-\u11ff]/],
  ["Chinese", /[\u4e00-\u9fff\u3400-\u4dbf]/],
  ["Russian", /[\u0400-\u04ff]/],
  ["Arabic", /[\u0600-\u06ff]/],
  ["Thai", /[\u0e00-\u0e7f]/],
  ["Portuguese", /\b(não|você|para|como|mais|isso|está|também)\b/i],
  ["Spanish", /\b(pero|como|para|esto|tiene|puede|también|sobre)\b/i],
];

function detectLanguage(text: string): string {
  for (const [lang, pattern] of LANG_PATTERNS) {
    if (pattern.test(text)) return lang;
  }
  return "English";
}

/**
 * Cluster by detected language of posts.
 * Each user is assigned to their most-used language.
 */
export function detectLanguageClusters(
  events: NostrEvent[],
  minClusterSize: number = 3,
  maxClusters: number = 10,
): Cluster[] {
  const textNotes = events.filter((e) => e.kind === NOSTR_KIND.TEXT_NOTE);

  // Count language per user
  const userLangCounts = new Map<string, Map<string, number>>();
  for (const event of textNotes) {
    const lang = detectLanguage(event.content);
    if (!userLangCounts.has(event.pubkey)) {
      userLangCounts.set(event.pubkey, new Map());
    }
    const counts = userLangCounts.get(event.pubkey)!;
    counts.set(lang, (counts.get(lang) ?? 0) + 1);
  }

  // Assign each user to their dominant language
  const langGroups = new Map<string, Set<string>>();
  for (const [pk, counts] of userLangCounts) {
    let bestLang = "English";
    let bestCount = 0;
    for (const [lang, count] of counts) {
      if (count > bestCount) {
        bestCount = count;
        bestLang = lang;
      }
    }
    if (!langGroups.has(bestLang)) langGroups.set(bestLang, new Set());
    langGroups.get(bestLang)!.add(pk);
  }

  // Convert to Cluster[]
  const clusters = [...langGroups.entries()]
    .filter(([, members]) => members.size >= minClusterSize)
    .sort((a, b) => b[1].size - a[1].size)
    .slice(0, maxClusters)
    .map(([lang, members], index) => ({
      id: `lang-${lang}`,
      label: lang,
      hashtags: [] as string[],
      memberPubkeys: members,
      color: getClusterColor(index),
    }));

  return clusters;
}
