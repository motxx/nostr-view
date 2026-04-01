import { create } from "zustand";

const FLASH_TTL_MS = 1000;
const EVENT_RATE_WINDOW_S = 60;

interface ActivityStore {
  /** pubkey → unix timestamp (seconds) of their most recent post */
  lastPostTime: Map<string, number>;

  /** Pubkeys that should flash (recently received event) */
  flashQueue: Set<string>;
  /** pubkey → Date.now() when flash was added */
  flashTimestamps: Map<string, number>;
  /** Events per second over the last 60 seconds */
  eventRate: number;
  /** Timestamps (ms) of events received in the rate window */
  _eventArrivals: number[];

  updateActivity: (pubkey: string, createdAt: number) => void;
  updateActivities: (entries: { pubkey: string; createdAt: number }[]) => void;
  addFlash: (pubkey: string) => void;
  clearExpiredFlashes: (now: number, ttlMs?: number) => void;
  recordEventArrival: () => void;
}

export const useActivityStore = create<ActivityStore>((set, get) => ({
  lastPostTime: new Map(),
  flashQueue: new Set(),
  flashTimestamps: new Map(),
  eventRate: 0,
  _eventArrivals: [],

  updateActivity: (pubkey, createdAt) => {
    const state = get();
    const existing = state.lastPostTime.get(pubkey);
    if (existing !== undefined && existing >= createdAt) return;
    const next = new Map(state.lastPostTime);
    next.set(pubkey, createdAt);
    set({ lastPostTime: next });
  },

  updateActivities: (entries) => {
    const state = get();
    const next = new Map(state.lastPostTime);
    let changed = false;
    for (const { pubkey, createdAt } of entries) {
      const existing = next.get(pubkey);
      if (existing === undefined || existing < createdAt) {
        next.set(pubkey, createdAt);
        changed = true;
      }
    }
    if (changed) set({ lastPostTime: next });
  },

  addFlash: (pubkey) => {
    const state = get();
    const nextQueue = new Set(state.flashQueue);
    nextQueue.add(pubkey);
    const nextTs = new Map(state.flashTimestamps);
    nextTs.set(pubkey, Date.now());
    set({ flashQueue: nextQueue, flashTimestamps: nextTs });
  },

  clearExpiredFlashes: (now, ttlMs = FLASH_TTL_MS) => {
    const state = get();
    if (state.flashQueue.size === 0) return;
    const nextQueue = new Set<string>();
    const nextTs = new Map(state.flashTimestamps);
    let changed = false;
    for (const pk of state.flashQueue) {
      const ts = state.flashTimestamps.get(pk) ?? 0;
      if (now - ts < ttlMs) {
        nextQueue.add(pk);
      } else {
        nextTs.delete(pk);
        changed = true;
      }
    }
    if (changed) {
      set({ flashQueue: nextQueue, flashTimestamps: nextTs });
    }
  },

  recordEventArrival: () => {
    const state = get();
    const now = Date.now();
    const cutoff = now - EVENT_RATE_WINDOW_S * 1000;
    const arrivals = [...state._eventArrivals.filter((t) => t > cutoff), now];
    const rate = arrivals.length / EVENT_RATE_WINDOW_S;
    set({ _eventArrivals: arrivals, eventRate: rate });
  },
}));
