import type { NostrEvent } from "@/domain/entities/nostr-event";
import { NOSTR_KIND } from "@/lib/nostr-kinds";

export interface InfluenceScores {
  [pubkey: string]: number;
}

export interface InfluenceMetrics {
  followerCount: number;
  reactionCount: number;
  repostCount: number;
  noteCount: number;
}

export interface InfluenceResult {
  scores: InfluenceScores;
  metrics: Map<string, InfluenceMetrics>;
}

export function calculateInfluence(
  events: NostrEvent[],
): InfluenceResult {
  const metrics = new Map<string, InfluenceMetrics>();

  const getOrCreate = (pubkey: string): InfluenceMetrics => {
    let m = metrics.get(pubkey);
    if (!m) {
      m = { followerCount: 0, reactionCount: 0, repostCount: 0, noteCount: 0 };
      metrics.set(pubkey, m);
    }
    return m;
  };

  for (const event of events) {
    switch (event.kind) {
      case NOSTR_KIND.TEXT_NOTE: {
        getOrCreate(event.pubkey).noteCount++;
        break;
      }
      case NOSTR_KIND.CONTACT_LIST: {
        // Each pubkey in the contact list tags is being followed
        for (const tag of event.tags) {
          if (tag[0] === "p") {
            getOrCreate(tag[1]).followerCount++;
          }
        }
        break;
      }
      case NOSTR_KIND.REACTION: {
        // The target of the reaction gets credit
        for (const tag of event.tags) {
          if (tag[0] === "p") {
            getOrCreate(tag[1]).reactionCount++;
            break;
          }
        }
        break;
      }
      case NOSTR_KIND.REPOST: {
        for (const tag of event.tags) {
          if (tag[0] === "p") {
            getOrCreate(tag[1]).repostCount++;
            break;
          }
        }
        break;
      }
    }
  }

  const scores: InfluenceScores = {};
  for (const [pubkey, m] of metrics) {
    scores[pubkey] =
      m.followerCount * 1.0 +
      m.reactionCount * 0.5 +
      m.repostCount * 2.0 +
      m.noteCount * 0.1;
  }
  return { scores, metrics };
}

/** @deprecated Use calculateInfluence instead */
export function calculateInfluenceScores(
  events: NostrEvent[],
): InfluenceScores {
  return calculateInfluence(events).scores;
}

export function getMetricsForPubkey(
  pubkey: string,
  events: NostrEvent[],
): InfluenceMetrics {
  const m: InfluenceMetrics = {
    followerCount: 0,
    reactionCount: 0,
    repostCount: 0,
    noteCount: 0,
  };

  for (const event of events) {
    if (event.kind === NOSTR_KIND.TEXT_NOTE && event.pubkey === pubkey) {
      m.noteCount++;
    } else if (event.kind === NOSTR_KIND.CONTACT_LIST) {
      if (event.tags.some((t) => t[0] === "p" && t[1] === pubkey)) {
        m.followerCount++;
      }
    } else if (event.kind === NOSTR_KIND.REACTION) {
      if (event.tags.some((t) => t[0] === "p" && t[1] === pubkey)) {
        m.reactionCount++;
      }
    } else if (event.kind === NOSTR_KIND.REPOST) {
      if (event.tags.some((t) => t[0] === "p" && t[1] === pubkey)) {
        m.repostCount++;
      }
    }
  }

  return m;
}
