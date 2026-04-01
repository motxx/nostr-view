export interface NostrEvent {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
}

export function getHashtags(event: NostrEvent): string[] {
  return event.tags
    .filter((tag) => tag[0] === "t")
    .map((tag) => tag[1].toLowerCase());
}

export function filterByHashtag(
  events: NostrEvent[],
  tag: string | null,
): NostrEvent[] {
  if (!tag) return events;
  return events.filter((e) => getHashtags(e).includes(tag));
}

export function getReferencedPubkeys(event: NostrEvent): string[] {
  return event.tags
    .filter((tag) => tag[0] === "p")
    .map((tag) => tag[1]);
}

export function getReferencedEventIds(event: NostrEvent): string[] {
  return event.tags
    .filter((tag) => tag[0] === "e")
    .map((tag) => tag[1]);
}
