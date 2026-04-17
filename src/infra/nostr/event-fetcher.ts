import type { Filter } from "nostr-tools";
import type { NostrEvent } from "@/domain/entities/nostr-event";
import { NOSTR_KIND } from "@/lib/nostr-kinds";
import { queryEvents, subscribeEvents } from "./relay-pool-impl";

export async function fetchRecentNotes(
  since: number,
  limit: number = 500,
): Promise<NostrEvent[]> {
  const filter: Filter = {
    kinds: [NOSTR_KIND.TEXT_NOTE],
    since,
    limit,
  };
  return queryEvents([filter]);
}

export async function fetchInteractions(
  since: number,
  limit: number = 500,
): Promise<NostrEvent[]> {
  const filter: Filter = {
    kinds: [NOSTR_KIND.REACTION, NOSTR_KIND.REPOST],
    since,
    limit,
  };
  return queryEvents([filter]);
}

export async function fetchContactLists(
  pubkeys: string[],
  limit: number = 200,
): Promise<NostrEvent[]> {
  if (pubkeys.length === 0) return [];
  const filter: Filter = {
    kinds: [NOSTR_KIND.CONTACT_LIST],
    authors: pubkeys,
    limit,
  };
  return queryEvents([filter]);
}

export async function fetchProfiles(
  pubkeys: string[],
): Promise<NostrEvent[]> {
  if (pubkeys.length === 0) return [];
  // Batch in chunks of 50
  const chunks: string[][] = [];
  for (let i = 0; i < pubkeys.length; i += 50) {
    chunks.push(pubkeys.slice(i, i + 50));
  }

  const results: NostrEvent[] = [];
  for (const chunk of chunks) {
    const filter: Filter = {
      kinds: [NOSTR_KIND.METADATA],
      authors: chunk,
    };
    const events = await queryEvents([filter]);
    results.push(...events);
  }
  return results;
}

export async function fetchUserNotes(
  pubkey: string,
  limit: number = 50,
): Promise<NostrEvent[]> {
  const filter: Filter = {
    kinds: [NOSTR_KIND.TEXT_NOTE],
    authors: [pubkey],
    limit,
  };
  return queryEvents([filter]);
}

/**
 * Fetch a user's full activity: their notes, replies to them, and reactions to them.
 * Returns all events combined (deduplicated by the event store).
 */
export async function fetchUserActivity(
  pubkey: string,
): Promise<NostrEvent[]> {
  const [ownNotes, mentions] = await Promise.allSettled([
    // Their own notes (up to 100)
    queryEvents([
      {
        kinds: [NOSTR_KIND.TEXT_NOTE],
        authors: [pubkey],
        limit: 100,
      },
    ]),
    // Notes/reactions/reposts that mention them (up to 100)
    queryEvents([
      {
        kinds: [NOSTR_KIND.TEXT_NOTE, NOSTR_KIND.REACTION, NOSTR_KIND.REPOST],
        "#p": [pubkey],
        limit: 100,
      },
    ]),
  ]);

  return [
    ...(ownNotes.status === "fulfilled" ? ownNotes.value : []),
    ...(mentions.status === "fulfilled" ? mentions.value : []),
  ];
}

export async function fetchOlderUserNotes(
  pubkey: string,
  until: number,
  limit: number = 50,
): Promise<NostrEvent[]> {
  const [ownNotes, mentions] = await Promise.allSettled([
    queryEvents([
      {
        kinds: [NOSTR_KIND.TEXT_NOTE],
        authors: [pubkey],
        until,
        limit,
      },
    ]),
    queryEvents([
      {
        kinds: [NOSTR_KIND.TEXT_NOTE, NOSTR_KIND.REACTION, NOSTR_KIND.REPOST],
        "#p": [pubkey],
        until,
        limit,
      },
    ]),
  ]);
  return [
    ...(ownNotes.status === "fulfilled" ? ownNotes.value : []),
    ...(mentions.status === "fulfilled" ? mentions.value : []),
  ];
}

export async function fetchOlderAuthorNotes(
  pubkeys: string[],
  until: number,
  limit: number = 100,
): Promise<NostrEvent[]> {
  if (pubkeys.length === 0) return [];
  const chunks: string[][] = [];
  for (let i = 0; i < pubkeys.length; i += 50) {
    chunks.push(pubkeys.slice(i, i + 50));
  }
  const results: NostrEvent[] = [];
  for (const chunk of chunks) {
    const events = await queryEvents([
      {
        kinds: [NOSTR_KIND.TEXT_NOTE],
        authors: chunk,
        until,
        limit: Math.ceil(limit / chunks.length),
      },
    ]);
    results.push(...events);
  }
  return results;
}

export function subscribeLiveNotes(
  onEvent: (event: NostrEvent) => void,
  onEose?: () => void,
): { close: () => void } {
  const filter: Filter = {
    kinds: [
      NOSTR_KIND.TEXT_NOTE,
      NOSTR_KIND.REACTION,
      NOSTR_KIND.REPOST,
    ],
    since: Math.floor(Date.now() / 1000),
  };
  return subscribeEvents([filter], onEvent, onEose);
}
