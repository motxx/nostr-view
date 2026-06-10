import type { NostrEvent } from "@/domain/entities/nostr-event";
import { getHashtags } from "@/domain/entities/nostr-event";
import { type Cluster, getClusterColor } from "@/domain/entities/cluster";
import { NOSTR_KIND } from "@/lib/nostr-kinds";
import { louvain, addUndirectedEdge, type WeightedGraph } from "./louvain";
import { rankTermsByCTfIdf } from "./cluster-labeling";

/**
 * Topic clustering via community detection on the hashtag co-occurrence
 * network — a literature-validated topic detection method for microblogs
 * (Weng & Menczer 2014, "Topicality and Social Impact"; topic-oriented
 * community detection on Twitter hashtag networks).
 *
 * Pipeline:
 *  1. Hashtags used by >= minClusterSize distinct users form nodes
 *     (noise filter from the literature).
 *  2. Edge weight = number of distinct users using both hashtags;
 *     edges below minCooccurrence shared users are dropped.
 *  3. Louvain (Blondel et al. 2008) partitions hashtags into topics.
 *  4. Each user joins the topic where they have the most tag usage.
 *  5. Labels ranked by c-TF-IDF so distinctive tags come first.
 */
export function detectClusters(
  events: NostrEvent[],
  minClusterSize: number = 3,
  maxClusters: number = 10,
  minCooccurrence: number = 2,
): Cluster[] {
  const textNotes = events.filter((e) => e.kind === NOSTR_KIND.TEXT_NOTE);

  // tag → distinct users, user → tag → usage count
  const hashtagUsers = new Map<string, Set<string>>();
  const userTagCounts = new Map<string, Map<string, number>>();

  for (const event of textNotes) {
    for (const tag of getHashtags(event)) {
      let users = hashtagUsers.get(tag);
      if (!users) {
        users = new Set();
        hashtagUsers.set(tag, users);
      }
      users.add(event.pubkey);

      let counts = userTagCounts.get(event.pubkey);
      if (!counts) {
        counts = new Map();
        userTagCounts.set(event.pubkey, counts);
      }
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  // Noise filter: a hashtag must be used by >= minClusterSize distinct users
  const significantTags = [...hashtagUsers.entries()]
    .filter(([, users]) => users.size >= minClusterSize)
    .sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0]));

  if (significantTags.length === 0) return [];

  // Hashtag co-occurrence graph (user-level, weight = shared users)
  const tagGraph: WeightedGraph = new Map();
  for (const [tag] of significantTags) tagGraph.set(tag, new Map());
  for (let i = 0; i < significantTags.length; i++) {
    for (let j = i + 1; j < significantTags.length; j++) {
      const [tag1, users1] = significantTags[i];
      const [tag2, users2] = significantTags[j];
      let shared = 0;
      for (const u of users1) {
        if (users2.has(u)) shared++;
      }
      if (shared >= minCooccurrence) {
        addUndirectedEdge(tagGraph, tag1, tag2, shared);
      }
    }
  }

  // Louvain on the tag graph → topic communities of hashtags
  const { communities } = louvain(tagGraph);
  const topicTags = new Map<number, string[]>();
  for (const [tag, community] of communities) {
    topicTags.set(community, [...(topicTags.get(community) ?? []), tag]);
  }

  // Assign each user to the topic where they have the most usage
  const tagToTopic = communities;
  const topicMembers = new Map<number, Set<string>>();
  for (const [pubkey, counts] of userTagCounts) {
    const usagePerTopic = new Map<number, number>();
    for (const [tag, count] of counts) {
      const topic = tagToTopic.get(tag);
      if (topic === undefined) continue;
      usagePerTopic.set(topic, (usagePerTopic.get(topic) ?? 0) + count);
    }
    if (usagePerTopic.size === 0) continue;
    const best = [...usagePerTopic.entries()].sort(
      (a, b) => b[1] - a[1] || a[0] - b[0],
    )[0][0];
    let members = topicMembers.get(best);
    if (!members) {
      members = new Set();
      topicMembers.set(best, members);
    }
    members.add(pubkey);
  }

  const kept = [...topicMembers.entries()]
    .filter(([, members]) => members.size >= minClusterSize)
    .sort((a, b) => b[1].size - a[1].size || a[0] - b[0])
    .slice(0, maxClusters);

  // Rank each topic's tags by c-TF-IDF over member usage of those tags
  const topicTermCounts = new Map<string, Map<string, number>>();
  for (const [topic, members] of kept) {
    const tagsInTopic = new Set(topicTags.get(topic) ?? []);
    const termCounts = new Map<string, number>();
    for (const pk of members) {
      const counts = userTagCounts.get(pk);
      if (!counts) continue;
      for (const [tag, count] of counts) {
        if (!tagsInTopic.has(tag)) continue;
        termCounts.set(tag, (termCounts.get(tag) ?? 0) + count);
      }
    }
    topicTermCounts.set(`topic-${topic}`, termCounts);
  }
  const rankedTags = rankTermsByCTfIdf(topicTermCounts);

  return kept.map(([topic, members], index) => {
    const ranked = rankedTags.get(`topic-${topic}`) ?? [];
    const tags = ranked.length > 0 ? ranked : (topicTags.get(topic) ?? []);
    return {
      id: `cluster-${topic}`,
      label: tags.slice(0, 3).join(", ") || `Topic ${index + 1}`,
      hashtags: tags.slice(0, 10),
      memberPubkeys: members,
      color: getClusterColor(index),
    };
  });
}
