import { SimplePool } from "nostr-tools";
import type { Filter } from "nostr-tools";
import type { NostrEvent } from "@/domain/entities/nostr-event";
import { DEFAULT_RELAYS } from "./default-relays";

let poolInstance: SimplePool | null = null;

export function getPool(): SimplePool {
  if (!poolInstance) {
    poolInstance = new SimplePool();
  }
  return poolInstance;
}

export function closePool(): void {
  if (poolInstance) {
    poolInstance.close(DEFAULT_RELAYS);
    poolInstance = null;
  }
}

export async function queryEvents(
  filters: Filter[],
  relays: string[] = DEFAULT_RELAYS,
): Promise<NostrEvent[]> {
  const pool = getPool();
  const events = await pool.querySync(relays, filters[0] ?? {});
  return events as unknown as NostrEvent[];
}

export function subscribeEvents(
  filters: Filter[],
  onEvent: (event: NostrEvent) => void,
  onEose?: () => void,
  relays: string[] = DEFAULT_RELAYS,
): { close: () => void } {
  const pool = getPool();
  // SimplePool.subscribeMany expects a single Filter object
  const mergedFilter = filters[0] ?? {};
  const sub = pool.subscribeMany(relays, mergedFilter, {
    onevent: (event) => onEvent(event as NostrEvent),
    oneose: onEose,
  });
  return { close: () => sub.close() };
}
