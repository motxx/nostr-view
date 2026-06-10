import type { NostrEvent } from "@/domain/entities/nostr-event";
import type { EdgeType } from "@/domain/entities/graph-edge";
import { NOSTR_KIND } from "@/lib/nostr-kinds";

/**
 * NIP-aware extraction of social interaction edges from Nostr events.
 * Single source of truth shared by the community clustering graph and the
 * 3D visualization graph.
 *
 * Spec-backed semantics instead of "every p-tag is an interaction":
 *
 * - NIP-10 (threading): a reply's p tags contain the WHOLE ancestor chain
 *   plus mentions — only the author of the `reply`-marked e tag (or
 *   positional equivalent) is the direct conversation partner. Ancestors
 *   and mentions become weaker `mention` edges. Measured on real relay
 *   data, 22% of p-tagged notes carry 2+ p tags (max 8), so treating all
 *   of them as replies inflates thread cliques.
 * - NIP-18: kind-6 reposts target the original author; kind-1 `q` tags
 *   are quote reposts (pubkey hint in position 3).
 * - NIP-25: reactions copy e/p tags from the reacted note; only the LAST
 *   p tag is the author being reacted to.
 * - NIP-57: kind-9735 zap receipts — recipient is the `p` tag, sender is
 *   the `P` tag or the pubkey of the embedded kind-9734 zap request in
 *   `description`. Zaps cost money: the strongest engagement signal.
 *
 * e/q tag author resolution uses the pubkey hint in the tag itself when
 * present, falling back to an id→author index over the loaded events.
 */

export type InteractionEdgeType = EdgeType;

export interface InteractionEdge {
  /** actor (who sent the event) */
  source: string;
  /** recipient of the interaction */
  target: string;
  type: InteractionEdgeType;
}

const HEX64 = /^[0-9a-f]{64}$/i;

/** Loose pubkey check: real keys are 64-hex; test fixtures are short ids. */
function isPubkeyLike(s: unknown): s is string {
  return typeof s === "string" && s.length > 0 && !s.includes(" ");
}

/** event id → author pubkey, for resolving e/q tag references. */
export function buildAuthorIndex(events: NostrEvent[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const e of events) index.set(e.id, e.pubkey);
  return index;
}

interface ETag {
  id: string;
  marker: string | undefined;
  pubkeyHint: string | undefined;
}

function parseETags(event: NostrEvent): ETag[] {
  const result: ETag[] = [];
  for (const tag of event.tags) {
    if (tag[0] !== "e" || !tag[1]) continue;
    const marker =
      tag[3] === "root" || tag[3] === "reply" || tag[3] === "mention"
        ? tag[3]
        : undefined;
    const pubkeyHint = HEX64.test(tag[4] ?? "") ? tag[4] : undefined;
    result.push({ id: tag[1], marker, pubkeyHint });
  }
  return result;
}

function resolveAuthor(
  tag: ETag,
  authorIndex: Map<string, string>,
): string | undefined {
  return tag.pubkeyHint ?? authorIndex.get(tag.id);
}

function extractTextNoteEdges(
  event: NostrEvent,
  authorIndex: Map<string, string>,
): InteractionEdge[] {
  const eTags = parseETags(event);
  const pTags = event.tags
    .filter((t) => t[0] === "p" && isPubkeyLike(t[1]))
    .map((t) => t[1]);

  // Direct reply target per NIP-10: the `reply`-marked e tag; a direct
  // reply to the thread root has only a `root`-marked tag. Positional
  // fallback (deprecated scheme): the LAST e tag is the parent.
  const hasMarkers = eTags.some((t) => t.marker !== undefined);
  let replyTag: ETag | undefined;
  if (hasMarkers) {
    replyTag =
      eTags.find((t) => t.marker === "reply") ??
      eTags.find((t) => t.marker === "root");
  } else if (eTags.length > 0) {
    replyTag = eTags[eTags.length - 1];
  }
  const replyAuthor = replyTag ? resolveAuthor(replyTag, authorIndex) : undefined;

  // Quote reposts: NIP-18 q tags ["q", <id>, <relay>, <pubkey>]
  const quoteAuthors = new Set<string>();
  for (const tag of event.tags) {
    if (tag[0] !== "q" || !tag[1]) continue;
    const author = HEX64.test(tag[3] ?? "")
      ? tag[3]
      : authorIndex.get(tag[1]);
    if (author) quoteAuthors.add(author);
  }

  const edges = new Map<string, InteractionEdge>();
  const add = (target: string | undefined, type: InteractionEdgeType) => {
    if (!target || target === event.pubkey) return;
    const key = `${type}:${target}`;
    if (!edges.has(key)) edges.set(key, { source: event.pubkey, target, type });
  };

  add(replyAuthor, "reply");
  for (const q of quoteAuthors) add(q, "quote");
  // Remaining p tags: thread ancestors + mentions (NIP-10 copies the whole
  // ancestor chain into p tags) — weaker co-participation signal.
  for (const p of pTags) {
    if (p === replyAuthor || quoteAuthors.has(p)) continue;
    add(p, "mention");
  }
  return [...edges.values()];
}

function extractTargetedEdge(
  event: NostrEvent,
  authorIndex: Map<string, string>,
  type: InteractionEdgeType,
): InteractionEdge[] {
  // NIP-25 (and repost convention): tags are copied from the target note;
  // the LAST p tag is the author of the event being reacted to/reposted.
  const pTags = event.tags
    .filter((t) => t[0] === "p" && isPubkeyLike(t[1]))
    .map((t) => t[1]);
  let target = pTags.length > 0 ? pTags[pTags.length - 1] : undefined;

  if (!target) {
    const eTags = parseETags(event);
    const last = eTags[eTags.length - 1];
    if (last) target = resolveAuthor(last, authorIndex);
  }
  if (!target || target === event.pubkey) return [];
  return [{ source: event.pubkey, target, type }];
}

function extractZapEdges(event: NostrEvent): InteractionEdge[] {
  // NIP-57 zap receipt: `p` = recipient, `P` = sender (newer receipts),
  // else the sender is the pubkey of the kind-9734 zap request embedded
  // in the `description` tag.
  const recipient = event.tags.find(
    (t) => t[0] === "p" && isPubkeyLike(t[1]),
  )?.[1];
  if (!recipient) return [];

  let sender = event.tags.find(
    (t) => t[0] === "P" && HEX64.test(t[1] ?? ""),
  )?.[1];
  if (!sender) {
    const description = event.tags.find((t) => t[0] === "description")?.[1];
    if (description) {
      try {
        const request = JSON.parse(description);
        if (HEX64.test(request?.pubkey ?? "")) sender = request.pubkey;
      } catch {
        // malformed zap request — skip
      }
    }
  }
  if (!sender || sender === recipient) return [];
  return [{ source: sender, target: recipient, type: "zap" }];
}

export function extractInteractionEdges(
  event: NostrEvent,
  authorIndex: Map<string, string>,
): InteractionEdge[] {
  switch (event.kind) {
    case NOSTR_KIND.TEXT_NOTE:
      return extractTextNoteEdges(event, authorIndex);
    case NOSTR_KIND.REACTION:
      return extractTargetedEdge(event, authorIndex, "reaction");
    case NOSTR_KIND.REPOST:
      return extractTargetedEdge(event, authorIndex, "repost");
    case NOSTR_KIND.ZAP_RECEIPT:
      return extractZapEdges(event);
    case NOSTR_KIND.CONTACT_LIST:
      return event.tags
        .filter((t) => t[0] === "p" && isPubkeyLike(t[1]))
        .map((t) => ({ source: event.pubkey, target: t[1], type: "follow" as const }))
        .filter((e) => e.source !== e.target);
    default:
      return [];
  }
}

export function extractAllInteractionEdges(
  events: NostrEvent[],
): InteractionEdge[] {
  const authorIndex = buildAuthorIndex(events);
  const result: InteractionEdge[] = [];
  for (const event of events) {
    result.push(...extractInteractionEdges(event, authorIndex));
  }
  return result;
}
