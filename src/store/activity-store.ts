import { create } from "zustand";

interface ActivityStore {
  /** pubkey → unix timestamp (seconds) of their most recent post */
  lastPostTime: Map<string, number>;

  updateActivity: (pubkey: string, createdAt: number) => void;
  updateActivities: (entries: { pubkey: string; createdAt: number }[]) => void;
}

export const useActivityStore = create<ActivityStore>((set, get) => ({
  lastPostTime: new Map(),

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
}));
