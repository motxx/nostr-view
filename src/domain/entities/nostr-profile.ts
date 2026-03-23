export interface NostrProfile {
  pubkey: string;
  name?: string;
  displayName?: string;
  picture?: string;
  about?: string;
  nip05?: string;
  lud16?: string;
  fetchedAt: number;
}

export function parseProfileContent(
  pubkey: string,
  content: string,
): NostrProfile {
  try {
    const parsed = JSON.parse(content);
    return {
      pubkey,
      name: parsed.name,
      displayName: parsed.display_name,
      picture: parsed.picture,
      about: parsed.about,
      nip05: parsed.nip05,
      lud16: parsed.lud16,
      fetchedAt: Date.now(),
    };
  } catch {
    return { pubkey, fetchedAt: Date.now() };
  }
}
