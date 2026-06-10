/**
 * Clustering evaluation on REAL Nostr events.
 *
 * Usage:
 *   bun scripts/eval-clustering.ts fetch   # fetch events from public relays → cache
 *   bun scripts/eval-clustering.ts run     # evaluate clustering on cached events
 *   bun scripts/eval-clustering.ts         # fetch if no cache, then run
 *
 * Compares the legacy heuristics (label propagation, greedy hashtag merge)
 * against the new literature-backed implementations (Louvain, hashtag
 * co-occurrence networks, RFM quintiles) on identical real data, using
 * modularity / coverage / balance as the yardstick, and checks
 * determinism under event reordering.
 */

import { SimplePool, type Filter } from "nostr-tools";
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { NostrEvent } from "../src/domain/entities/nostr-event";
import {
  getReferencedPubkeys,
  getHashtags,
} from "../src/domain/entities/nostr-event";
import type { Cluster } from "../src/domain/entities/cluster";
import { getClusterColor } from "../src/domain/entities/cluster";
import { NOSTR_KIND } from "../src/lib/nostr-kinds";
import {
  detectClustersByStrategy,
  selectBestClusters,
  CLUSTER_STRATEGIES,
} from "../src/domain/services/cluster-strategy";
import { evaluateClusterQuality } from "../src/domain/services/cluster-quality";
import {
  buildInteractionGraph,
  INTERACTION_WEIGHTS,
  type InteractionWeights,
} from "../src/domain/services/interaction-cluster";
import {
  louvain,
  addUndirectedEdge,
  type WeightedGraph,
} from "../src/domain/services/louvain";
import {
  calculateEngagement,
  RECIPROCITY_WEIGHT,
} from "../src/domain/services/engagement";

const ZERO_WEIGHTS: InteractionWeights = {
  zap: 0,
  reply: 0,
  repost: 0,
  quote: 0,
  reaction: 0,
  mention: 0,
  follow: 0,
};

const RELAYS = [
  "wss://relay.nostr.band",
  "wss://nos.lol",
  "wss://relay.damus.io",
];

const CACHE_DIR = join(dirname(fileURLToPath(import.meta.url)), ".cache");
const CACHE_FILE = join(CACHE_DIR, "eval-events.json");
const RESULTS_FILE = join(CACHE_DIR, "eval-results.json");

// ───────────────────────── fetch ─────────────────────────

async function fetchEvents(): Promise<NostrEvent[]> {
  const pool = new SimplePool();
  const since = Math.floor(Date.now() / 1000) - 6 * 60 * 60; // 6h window

  console.log(`Fetching from ${RELAYS.join(", ")} (since ${since})...`);

  const query = (filter: Filter) =>
    pool.querySync(RELAYS, filter, { maxWait: 15_000 });

  const notes = await query({
    kinds: [NOSTR_KIND.TEXT_NOTE],
    since,
    limit: 1500,
  });
  console.log(`  notes: ${notes.length}`);

  const interactions = await query({
    kinds: [NOSTR_KIND.REACTION, NOSTR_KIND.REPOST, NOSTR_KIND.ZAP_RECEIPT],
    since,
    limit: 1500,
  });
  console.log(`  reactions/reposts/zaps: ${interactions.length}`);

  const authors = [...new Set(notes.map((e) => e.pubkey))].slice(0, 300);
  const contacts: NostrEvent[] = [];
  for (let i = 0; i < authors.length; i += 100) {
    const chunk = await query({
      kinds: [NOSTR_KIND.CONTACT_LIST],
      authors: authors.slice(i, i + 100),
    });
    contacts.push(...(chunk as NostrEvent[]));
  }
  console.log(`  contact lists: ${contacts.length}`);

  // Targeted zap receipts for the visible authors (mirrors the app)
  const zaps: NostrEvent[] = [];
  for (let i = 0; i < authors.length; i += 100) {
    const chunk = await query({
      kinds: [NOSTR_KIND.ZAP_RECEIPT],
      "#p": authors.slice(i, i + 100),
      since,
    });
    zaps.push(...(chunk as NostrEvent[]));
  }
  console.log(`  targeted zap receipts: ${zaps.length}`);

  pool.close(RELAYS);

  const all = [...notes, ...interactions, ...contacts, ...zaps] as NostrEvent[];
  // dedupe by id
  const byId = new Map<string, NostrEvent>();
  for (const e of all) byId.set(e.id, e);
  return [...byId.values()];
}

// ─────────────────── legacy implementations ───────────────────
// Copied verbatim (modulo formatting) from the pre-rewrite codebase so the
// comparison runs on identical data with identical types.

function legacyLabelPropagation(
  events: NostrEvent[],
  minClusterSize = 3,
  maxClusters = 10,
): Cluster[] {
  const interactions = new Map<string, Map<string, number>>();
  const allPubkeys = new Set<string>();
  function addEdge(a: string, b: string, weight: number) {
    allPubkeys.add(a);
    allPubkeys.add(b);
    if (!interactions.has(a)) interactions.set(a, new Map());
    if (!interactions.has(b)) interactions.set(b, new Map());
    interactions.get(a)!.set(b, (interactions.get(a)!.get(b) ?? 0) + weight);
    interactions.get(b)!.set(a, (interactions.get(b)!.get(a) ?? 0) + weight);
  }
  for (const event of events) {
    const refs = getReferencedPubkeys(event);
    if (refs.length === 0) continue;
    switch (event.kind) {
      case NOSTR_KIND.TEXT_NOTE:
        for (const ref of refs) addEdge(event.pubkey, ref, 2);
        break;
      case NOSTR_KIND.REACTION:
        for (const ref of refs) addEdge(event.pubkey, ref, 1);
        break;
      case NOSTR_KIND.REPOST:
        for (const ref of refs) addEdge(event.pubkey, ref, 1.5);
        break;
      case NOSTR_KIND.CONTACT_LIST:
        for (const ref of refs) addEdge(event.pubkey, ref, 0.5);
        break;
    }
  }
  if (allPubkeys.size === 0) return [];
  const labels = new Map<string, string>();
  for (const pk of allPubkeys) labels.set(pk, pk);
  for (let iter = 0; iter < 15; iter++) {
    let changed = false;
    for (const pk of allPubkeys) {
      const neighbors = interactions.get(pk);
      if (!neighbors || neighbors.size === 0) continue;
      const labelWeights = new Map<string, number>();
      for (const [neighbor, weight] of neighbors) {
        const nl = labels.get(neighbor) ?? neighbor;
        labelWeights.set(nl, (labelWeights.get(nl) ?? 0) + weight);
      }
      let bestLabel = labels.get(pk)!;
      let bestWeight = 0;
      for (const [label, weight] of labelWeights) {
        if (weight > bestWeight) {
          bestWeight = weight;
          bestLabel = label;
        }
      }
      if (bestLabel !== labels.get(pk)) {
        labels.set(pk, bestLabel);
        changed = true;
      }
    }
    if (!changed) break;
  }
  const groups = new Map<string, Set<string>>();
  for (const [pk, label] of labels) {
    if (!groups.has(label)) groups.set(label, new Set());
    groups.get(label)!.add(pk);
  }
  return [...groups.entries()]
    .filter(([, members]) => members.size >= minClusterSize)
    .sort((a, b) => b[1].size - a[1].size)
    .slice(0, maxClusters)
    .map(([, members], index) => ({
      id: `legacy-lpa-${index}`,
      label: `LPA ${index}`,
      hashtags: [],
      memberPubkeys: members,
      color: getClusterColor(index),
    }));
}

function legacyGreedyTopic(
  events: NostrEvent[],
  minClusterSize = 3,
  maxClusters = 10,
): Cluster[] {
  const textNotes = events.filter((e) => e.kind === NOSTR_KIND.TEXT_NOTE);
  const hashtagUsers = new Map<string, Set<string>>();
  for (const event of textNotes) {
    for (const tag of getHashtags(event)) {
      if (!hashtagUsers.has(tag)) hashtagUsers.set(tag, new Set());
      hashtagUsers.get(tag)!.add(event.pubkey);
    }
  }
  const significantTags = [...hashtagUsers.entries()]
    .filter(([, users]) => users.size >= minClusterSize)
    .sort((a, b) => b[1].size - a[1].size)
    .slice(0, maxClusters * 3);
  const cooccurrences: { tag1: string; tag2: string; count: number }[] = [];
  for (let i = 0; i < significantTags.length; i++) {
    for (let j = i + 1; j < significantTags.length; j++) {
      const [tag1, users1] = significantTags[i];
      const [tag2, users2] = significantTags[j];
      let overlap = 0;
      for (const u of users1) if (users2.has(u)) overlap++;
      if (overlap > 0) cooccurrences.push({ tag1, tag2, count: overlap });
    }
  }
  const tagToCluster = new Map<string, number>();
  let nextClusterId = 0;
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
  }
  for (const [tag] of significantTags) {
    if (!tagToCluster.has(tag)) tagToCluster.set(tag, nextClusterId++);
  }
  const clusterMap = new Map<number, { hashtags: Set<string>; members: Set<string> }>();
  for (const [tag, clusterId] of tagToCluster) {
    if (!clusterMap.has(clusterId))
      clusterMap.set(clusterId, { hashtags: new Set(), members: new Set() });
    const cluster = clusterMap.get(clusterId)!;
    cluster.hashtags.add(tag);
    for (const u of hashtagUsers.get(tag) ?? []) cluster.members.add(u);
  }
  return [...clusterMap.entries()]
    .map(([id, { hashtags, members }], index) => ({
      id: `legacy-greedy-${id}`,
      label: [...hashtags].slice(0, 3).join(", "),
      hashtags: [...hashtags],
      memberPubkeys: members,
      color: getClusterColor(index),
    }))
    .filter((c) => c.memberPubkeys.size >= minClusterSize)
    .sort((a, b) => b.memberPubkeys.size - a.memberPubkeys.size)
    .slice(0, maxClusters);
}

/**
 * The pre-NIP-aware interaction graph: every p-tag of every event becomes
 * an edge (active users only). Kept for before/after comparison.
 */
function legacyPtagGraph(events: NostrEvent[]): WeightedGraph {
  const active = new Set<string>();
  for (const e of events) {
    if (e.kind === NOSTR_KIND.TEXT_NOTE) active.add(e.pubkey);
  }
  const graph: WeightedGraph = new Map();
  for (const event of events) {
    let weight = 0;
    switch (event.kind) {
      case NOSTR_KIND.TEXT_NOTE: weight = 2; break;
      case NOSTR_KIND.REPOST: weight = 1.5; break;
      case NOSTR_KIND.REACTION: weight = 1; break;
      default: continue;
    }
    for (const ref of getReferencedPubkeys(event)) {
      if (active.has(event.pubkey) && active.has(ref) && event.pubkey !== ref) {
        addUndirectedEdge(graph, event.pubkey, ref, weight);
      }
    }
  }
  return graph;
}

// ───────────────────────── evaluate ─────────────────────────

function memberSignature(clusters: Cluster[]): string {
  return clusters
    .map((c) => [...c.memberPubkeys].sort().join(","))
    .sort()
    .join("|");
}

interface EvalRow {
  name: string;
  numClusters: number;
  sizes: number[];
  modularity: number;
  coverage: number;
  balance: number;
  score: number;
  deterministic: boolean;
  topLabels: string[];
}

function evaluate(
  name: string,
  detect: (events: NostrEvent[]) => Cluster[],
  events: NostrEvent[],
): EvalRow {
  const clusters = detect(events);
  const q = evaluateClusterQuality(clusters, events);
  // determinism / order-independence: reversed event order must not change memberships
  const reversed = detect([...events].reverse());
  const deterministic =
    memberSignature(detect(events)) === memberSignature(clusters) &&
    memberSignature(reversed) === memberSignature(clusters);
  return {
    name,
    numClusters: clusters.length,
    sizes: clusters.map((c) => c.memberPubkeys.size),
    modularity: q.modularity,
    coverage: q.coverage,
    balance: q.balance,
    score: q.score,
    deterministic,
    topLabels: clusters.slice(0, 5).map((c) => c.label),
  };
}

function printRow(r: EvalRow) {
  console.log(
    `  ${r.name.padEnd(28)} k=${String(r.numClusters).padStart(2)}  ` +
      `Q=${r.modularity.toFixed(3).padStart(6)}  ` +
      `cov=${(r.coverage * 100).toFixed(0).padStart(3)}%  ` +
      `bal=${r.balance.toFixed(2)}  ` +
      `score=${r.score.toFixed(3)}  ` +
      `stable=${r.deterministic ? "yes" : "NO"}`,
  );
  console.log(`  ${"".padEnd(28)} sizes=[${r.sizes.join(", ")}]`);
  if (r.topLabels.some((l) => l)) {
    console.log(`  ${"".padEnd(28)} labels: ${r.topLabels.join(" / ")}`);
  }
}

function run(events: NostrEvent[]) {
  const notes = events.filter((e) => e.kind === NOSTR_KIND.TEXT_NOTE).length;
  const reactions = events.filter((e) => e.kind === NOSTR_KIND.REACTION).length;
  const reposts = events.filter((e) => e.kind === NOSTR_KIND.REPOST).length;
  const contacts = events.filter((e) => e.kind === NOSTR_KIND.CONTACT_LIST).length;
  const authors = new Set(
    events.filter((e) => e.kind === NOSTR_KIND.TEXT_NOTE).map((e) => e.pubkey),
  ).size;
  console.log(
    `\nDataset: ${events.length} events (${notes} notes, ${reactions} reactions, ` +
      `${reposts} reposts, ${contacts} contact lists) — ${authors} note authors\n`,
  );

  const noFollows = events.filter((e) => e.kind !== NOSTR_KIND.CONTACT_LIST);

  const rows: EvalRow[] = [];

  console.log("── Social facet: legacy label propagation vs Louvain ──");
  rows.push(evaluate("LPA (legacy)", (ev) => legacyLabelPropagation(ev), events));
  printRow(rows[rows.length - 1]);
  rows.push(
    evaluate(
      "Louvain (new)",
      (ev) => detectClustersByStrategy(ev, "interaction"),
      events,
    ),
  );
  printRow(rows[rows.length - 1]);
  rows.push(
    evaluate(
      "Louvain w/o follows",
      (ev) => detectClustersByStrategy(ev, "interaction"),
      noFollows,
    ),
  );
  printRow(rows[rows.length - 1]);

  console.log("\n── Follow-weight sweep (hypothesis: contact lists glue communities) ──");
  for (const followWeight of [0, 0.25, 0.5, 1.0]) {
    const graph = buildInteractionGraph(events, {
      ...INTERACTION_WEIGHTS,
      follow: followWeight,
    });
    const { communities, modularity } = louvain(graph);
    const sizes = new Map<number, number>();
    for (const c of communities.values())
      sizes.set(c, (sizes.get(c) ?? 0) + 1);
    const big = [...sizes.values()].filter((s) => s >= 3).sort((a, b) => b - a);
    console.log(
      `  follow=${followWeight.toFixed(2)}  Q=${modularity.toFixed(3)}  ` +
        `communities(≥3)=${big.length}  sizes=[${big.slice(0, 8).join(", ")}]`,
    );
  }

  console.log("\n── Edge extraction: legacy all-p-tags vs NIP-aware ──");
  for (const [name, graph] of [
    ["legacy p-tag graph", legacyPtagGraph(events)],
    ["NIP-aware graph (new)", buildInteractionGraph(events)],
  ] as [string, WeightedGraph][]) {
    let edgeCount = 0;
    for (const adj of graph.values()) edgeCount += adj.size;
    const { communities, modularity } = louvain(graph);
    const sizes = new Map<number, number>();
    for (const c of communities.values()) sizes.set(c, (sizes.get(c) ?? 0) + 1);
    const big = [...sizes.values()].filter((s) => s >= 3).sort((a, b) => b - a);
    console.log(
      `  ${name.padEnd(24)} nodes=${graph.size} edges=${edgeCount / 2}  ` +
        `Q=${modularity.toFixed(3)}  communities(≥3)=${big.length}  ` +
        `sizes=[${big.slice(0, 8).join(", ")}]`,
    );
  }

  console.log("\n── Interaction-weight sweep (edge-type sensitivity) ──");
  // Edge composition: how much graph mass does each event type contribute?
  for (const type of ["reply", "mention", "quote", "repost", "reaction", "zap"] as const) {
    const g = buildInteractionGraph(events, { ...ZERO_WEIGHTS, [type]: 1 });
    let edges = 0;
    for (const adj of g.values()) edges += adj.size;
    console.log(`  composition: ${type.padEnd(9)} nodes=${String(g.size).padStart(3)} edges=${edges / 2}`);
  }
  for (const [name, w] of [
    ["current", INTERACTION_WEIGHTS],
    ["all equal", { ...INTERACTION_WEIGHTS, zap: 1, reply: 1, repost: 1, quote: 1, reaction: 1, mention: 1 }],
    ["reply-dominant", { ...INTERACTION_WEIGHTS, zap: 1, reply: 4, repost: 1, quote: 1, reaction: 0.5, mention: 0.5 }],
    ["no mentions", { ...INTERACTION_WEIGHTS, mention: 0 }],
  ] as [string, InteractionWeights][]) {
    const graph = buildInteractionGraph(events, w);
    const { communities, modularity } = louvain(graph);
    const sizes = new Map<number, number>();
    for (const c of communities.values()) sizes.set(c, (sizes.get(c) ?? 0) + 1);
    const big = [...sizes.values()].filter((s) => s >= 3).sort((a, b) => b - a);
    console.log(
      `  ${name.padEnd(24)} Q=${modularity.toFixed(3)}  communities(≥3)=${big.length}  ` +
        `sizes=[${big.slice(0, 8).join(", ")}]`,
    );
  }

  // NIP-10 concern: kind-1 p-tags include thread ancestors + mentions, not
  // just the direct reply target. How many notes carry multiple p-tags?
  const pTagCounts = events
    .filter((e) => e.kind === NOSTR_KIND.TEXT_NOTE)
    .map((e) => e.tags.filter((t) => t[0] === "p").length)
    .filter((n) => n > 0);
  const multi = pTagCounts.filter((n) => n > 1).length;
  const maxP = Math.max(0, ...pTagCounts);
  console.log(
    `  kind-1 notes with p-tags: ${pTagCounts.length}, ` +
      `multi-p (thread ancestors/mentions): ${multi} (${Math.round((100 * multi) / Math.max(1, pTagCounts.length))}%), max p-tags=${maxP}`,
  );

  console.log("\n── Topic facet: legacy greedy merge vs co-occurrence Louvain ──");
  rows.push(evaluate("Greedy merge (legacy)", (ev) => legacyGreedyTopic(ev), events));
  printRow(rows[rows.length - 1]);
  rows.push(
    evaluate("Co-occur Louvain (new)", (ev) => detectClustersByStrategy(ev, "topic"), events),
  );
  printRow(rows[rows.length - 1]);

  console.log("\n── Other facets ──");
  for (const s of ["language", "engagement"] as const) {
    rows.push(evaluate(s, (ev) => detectClustersByStrategy(ev, s), events));
    printRow(rows[rows.length - 1]);
  }

  console.log("\n── Engagement coefficients: validation on real data ──");
  {
    const { metrics } = calculateEngagement(events);
    const authors = [...new Set(
      events.filter((e) => e.kind === NOSTR_KIND.TEXT_NOTE).map((e) => e.pubkey),
    )];

    // 1. Spam resistance: prolific authors with zero received MUST score 0
    const spamLike = authors.filter((pk) => {
      const m = metrics.get(pk);
      return m && m.noteCount >= 5 && m.receivedScore === 0;
    });
    const spamNonZero = spamLike.filter((pk) => metrics.get(pk)!.score > 0);
    console.log(
      `  spam check: ${spamLike.length} prolific-but-ignored authors, ` +
        `${spamNonZero.length} with score>0 → ${spamNonZero.length === 0 ? "PASS (all 0)" : "FAIL"}`,
    );

    // 2. Top-10 composition: verifiable breakdown, inbound partner counts
    const ranked = authors
      .map((pk) => ({ pk, m: metrics.get(pk) }))
      .filter((r) => r.m)
      .sort((a, b) => b.m!.score - a.m!.score);
    console.log("  top-10 by engagement (score = received + 2×mutual):");
    for (const { pk, m } of ranked.slice(0, 10)) {
      console.log(
        `    ${pk.slice(0, 8)}…  score=${m!.score.toFixed(1).padStart(6)}  ` +
          `zap=${m!.zapsReceived} reply=${m!.repliesReceived} react=${m!.reactionsReceived} ` +
          `repost=${m!.repostsReceived + m!.quotesReceived} mention=${m!.mentionsReceived}  ` +
          `inbound=${m!.inboundPartners} mutual=${m!.reciprocalPartners} notes=${m!.noteCount}`,
      );
    }

    // 3. Coefficient sensitivity: is the top-10 ranking robust to the
    //    ad-hoc weight choices? (acceptance: overlap >= 7/10 per variant)
    const baseTop = new Set(ranked.slice(0, 10).map((r) => r.pk));
    const variants: [string, InteractionWeights][] = [
      ["all equal 1", { ...INTERACTION_WEIGHTS, zap: 1, reply: 1, repost: 1, quote: 1, reaction: 1, mention: 1 }],
      ["zap-heavy 8", { ...INTERACTION_WEIGHTS, zap: 8 }],
      ["mention-free", { ...INTERACTION_WEIGHTS, mention: 0 }],
    ];
    let allRobust = true;
    for (const [name, w] of variants) {
      const alt = calculateEngagement(events, w);
      const altTop = authors
        .map((pk) => ({ pk, s: alt.scores[pk] ?? 0 }))
        .sort((a, b) => b.s - a.s)
        .slice(0, 10);
      const overlap = altTop.filter((r) => baseTop.has(r.pk)).length;
      if (overlap < 7) allRobust = false;
      console.log(`  sensitivity ${name.padEnd(14)} top-10 overlap=${overlap}/10`);
    }

    // 4. Attention breadth sanity: high scores should come from MANY
    //    distinct people (Spearman rank corr. score vs inboundPartners)
    const engaged = ranked.filter((r) => r.m!.score > 0);
    const rankOf = (arr: typeof engaged, key: (m: NonNullable<typeof engaged[0]["m"]>) => number) => {
      const sorted = [...arr].sort((a, b) => key(b.m!) - key(a.m!));
      const map = new Map<string, number>();
      sorted.forEach((r, i) => map.set(r.pk, i));
      return map;
    };
    const r1 = rankOf(engaged, (m) => m.score);
    const r2 = rankOf(engaged, (m) => m.inboundPartners);
    let d2 = 0;
    for (const { pk } of engaged) d2 += (r1.get(pk)! - r2.get(pk)!) ** 2;
    const n = engaged.length;
    const spearman = n > 2 ? 1 - (6 * d2) / (n * (n * n - 1)) : 1;
    console.log(
      `  rank corr(score, distinct inbound partners) = ${spearman.toFixed(3)} ` +
        `(${spearman > 0.7 ? "PASS" : "check"}), reciprocity weight = ${RECIPROCITY_WEIGHT}`,
    );
    console.log(
      `  verdict: ${spamNonZero.length === 0 && allRobust && spearman > 0.7 ? "coefficients ACCEPTED (spam=0, ranking robust, breadth-aligned)" : "needs tuning"}`,
    );
  }

  console.log("\n── Auto selection ──");
  const selection = selectBestClusters(events);
  console.log(`  winner: ${selection.strategy}`);
  for (const s of CLUSTER_STRATEGIES) {
    const q = selection.qualities[s]!;
    console.log(
      `    ${s.padEnd(12)} score=${q.score.toFixed(3)} ` +
        `(Q=${q.modularity.toFixed(3)}, cov=${(q.coverage * 100).toFixed(0)}%, ` +
        `bal=${q.balance.toFixed(2)}, k=${q.numClusters})`,
    );
  }

  writeFileSync(
    RESULTS_FILE,
    JSON.stringify(
      {
        dataset: { events: events.length, notes, reactions, reposts, contacts, authors },
        rows,
        auto: { winner: selection.strategy, qualities: selection.qualities },
      },
      null,
      2,
    ),
  );
  console.log(`\nResults written to ${RESULTS_FILE}`);
}

// ───────────────────────── main ─────────────────────────

const mode = process.argv[2] ?? "auto";
// optional dataset override: bun scripts/eval-clustering.ts run <cache.json>
const cacheFile = process.argv[3] ?? CACHE_FILE;
mkdirSync(dirname(CACHE_FILE), { recursive: true });

if (mode === "fetch" || (mode === "auto" && !existsSync(cacheFile))) {
  const events = await fetchEvents();
  writeFileSync(cacheFile, JSON.stringify(events));
  console.log(`Cached ${events.length} events → ${cacheFile}`);
  if (mode === "fetch") process.exit(0);
}

const events: NostrEvent[] = JSON.parse(readFileSync(cacheFile, "utf8"));
run(events);
process.exit(0);
