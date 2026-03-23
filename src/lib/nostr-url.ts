import { nip19 } from "nostr-tools";

/** Generate a Primal URL for a note */
export function primalNoteUrl(eventId: string): string {
  const nevent = nip19.neventEncode({ id: eventId });
  return `https://primal.net/e/${nevent}`;
}

/** Generate a Primal URL for a profile */
export function primalProfileUrl(pubkey: string): string {
  const npub = nip19.npubEncode(pubkey);
  return `https://primal.net/p/${npub}`;
}
