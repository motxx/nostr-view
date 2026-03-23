import type { NostrEvent } from "@/domain/entities/nostr-event";
import { getHashtags } from "@/domain/entities/nostr-event";
import { type Cluster, getClusterColor } from "@/domain/entities/cluster";
import { NOSTR_KIND } from "@/lib/nostr-kinds";

interface HashtagCooccurrence {
  tag1: string;
  tag2: string;
  count: number;
}

export function detectClusters(
  events: NostrEvent[],
  minClusterSize: number = 3,
  maxClusters: number = 10,
): Cluster[] {
  const textNotes = events.filter((e) => e.kind === NOSTR_KIND.TEXT_NOTE);

  // Build hashtag → pubkey set mapping
  const hashtagUsers = new Map<string, Set<string>>();
  const userHashtags = new Map<string, Set<string>>();

  for (const event of textNotes) {
    const hashtags = getHashtags(event);
    for (const tag of hashtags) {
      let users = hashtagUsers.get(tag);
      if (!users) {
        users = new Set();
        hashtagUsers.set(tag, users);
      }
      users.add(event.pubkey);

      let tags = userHashtags.get(event.pubkey);
      if (!tags) {
        tags = new Set();
        userHashtags.set(event.pubkey, tags);
      }
      tags.add(tag);
    }
  }

  // Filter hashtags with enough users
  const significantTags = [...hashtagUsers.entries()]
    .filter(([, users]) => users.size >= minClusterSize)
    .sort((a, b) => b[1].size - a[1].size)
    .slice(0, maxClusters * 3);

  // Build co-occurrence matrix
  const cooccurrences: HashtagCooccurrence[] = [];
  for (let i = 0; i < significantTags.length; i++) {
    for (let j = i + 1; j < significantTags.length; j++) {
      const [tag1, users1] = significantTags[i];
      const [tag2, users2] = significantTags[j];
      let overlap = 0;
      for (const u of users1) {
        if (users2.has(u)) overlap++;
      }
      if (overlap > 0) {
        cooccurrences.push({ tag1, tag2, count: overlap });
      }
    }
  }

  // Simple greedy clustering: merge highly co-occurring hashtags
  const tagToCluster = new Map<string, number>();
  let nextClusterId = 0;

  // Sort by co-occurrence strength
  cooccurrences.sort((a, b) => b.count - a.count);

  for (const { tag1, tag2 } of cooccurrences) {
    const c1 = tagToCluster.get(tag1);
    const c2 = tagToCluster.get(tag2);

    if (c1 === undefined && c2 === undefined) {
      const id = nextClusterId++;
      tagToCluster.set(tag1, id);
      tagToCluster.set(tag2, id);
    } else if (c1 !== undefined && c2 === undefined) {
      tagToCluster.set(tag2, c1);
    } else if (c1 === undefined && c2 !== undefined) {
      tagToCluster.set(tag1, c2);
    }
    // If both assigned, don't merge (keep clusters separate)
  }

  // Assign remaining significant tags as their own cluster
  for (const [tag] of significantTags) {
    if (!tagToCluster.has(tag)) {
      tagToCluster.set(tag, nextClusterId++);
    }
  }

  // Build cluster objects
  const clusterMap = new Map<
    number,
    { hashtags: Set<string>; members: Set<string> }
  >();

  for (const [tag, clusterId] of tagToCluster) {
    let cluster = clusterMap.get(clusterId);
    if (!cluster) {
      cluster = { hashtags: new Set(), members: new Set() };
      clusterMap.set(clusterId, cluster);
    }
    cluster.hashtags.add(tag);
    const users = hashtagUsers.get(tag);
    if (users) {
      for (const u of users) {
        cluster.members.add(u);
      }
    }
  }

  // Convert to Cluster objects, sorted by size
  const clusters = [...clusterMap.entries()]
    .map(([id, { hashtags, members }], index) => ({
      id: `cluster-${id}`,
      label: [...hashtags].slice(0, 3).join(", "),
      hashtags: [...hashtags],
      memberPubkeys: members,
      color: getClusterColor(index),
    }))
    .filter((c) => c.memberPubkeys.size >= minClusterSize)
    .sort((a, b) => b.memberPubkeys.size - a.memberPubkeys.size)
    .slice(0, maxClusters);

  return clusters;
}
