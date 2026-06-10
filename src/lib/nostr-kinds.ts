export const NOSTR_KIND = {
  METADATA: 0,
  TEXT_NOTE: 1,
  CONTACT_LIST: 3,
  REPOST: 6,
  REACTION: 7,
  /** NIP-57 zap receipt */
  ZAP_RECEIPT: 9735,
} as const;

export type NostrKind = (typeof NOSTR_KIND)[keyof typeof NOSTR_KIND];
