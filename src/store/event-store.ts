import { create } from "zustand";
import type { NostrEvent } from "@/domain/entities/nostr-event";
import type { NostrProfile } from "@/domain/entities/nostr-profile";
import { parseProfileContent } from "@/domain/entities/nostr-profile";
import { NOSTR_KIND } from "@/lib/nostr-kinds";

/**
 * PERF NOTE — Mutate-in-place pattern
 *
 * eventsById / eventsByKind / eventsByAuthor are mutated in place for
 * performance (avoids copying large Maps on every event). Zustand
 * subscribers using (s) => s.eventsById will NOT re-render because
 * the Map reference never changes. Use totalEvents (a number) as the
 * change signal instead, and read data via getState() when needed.
 *
 * profiles is the exception: a new Map reference is created when
 * metadata changes, so (s) => s.profiles works as a normal selector.
 */
interface EventStore {
  // Indexed events (mutated in place — see note above)
  eventsById: Map<string, NostrEvent>;
  eventsByKind: Map<number, Map<string, NostrEvent>>;
  eventsByAuthor: Map<string, Map<string, NostrEvent>>;
  profiles: Map<string, NostrProfile>;

  // Stats
  totalEvents: number;
  connectionStatus: "connecting" | "connected" | "error";

  // Actions
  addEvent: (event: NostrEvent) => void;
  addEvents: (events: NostrEvent[]) => void;
  setConnectionStatus: (status: "connecting" | "connected" | "error") => void;
  getAllEvents: () => NostrEvent[];
  getEventsByKind: (kind: number) => NostrEvent[];
  clear: () => void;
}

export const useEventStore = create<EventStore>((set, get) => ({
  eventsById: new Map(),
  eventsByKind: new Map(),
  eventsByAuthor: new Map(),
  profiles: new Map(),
  totalEvents: 0,
  connectionStatus: "connecting",

  addEvent: (event: NostrEvent) => {
    const state = get();
    if (state.eventsById.has(event.id)) return;

    // Mutate existing maps in place, then set new references only for
    // maps that changed. This avoids copying the entire Map per event.
    state.eventsById.set(event.id, event);

    if (!state.eventsByKind.has(event.kind)) {
      state.eventsByKind.set(event.kind, new Map());
    }
    state.eventsByKind.get(event.kind)!.set(event.id, event);

    if (!state.eventsByAuthor.has(event.pubkey)) {
      state.eventsByAuthor.set(event.pubkey, new Map());
    }
    state.eventsByAuthor.get(event.pubkey)!.set(event.id, event);

    const patch: Partial<EventStore> = {
      totalEvents: state.eventsById.size,
    };

    if (event.kind === NOSTR_KIND.METADATA) {
      const existing = state.profiles.get(event.pubkey);
      if (!existing || existing.fetchedAt < event.created_at * 1000) {
        state.profiles.set(
          event.pubkey,
          parseProfileContent(event.pubkey, event.content),
        );
        // New reference so (s) => s.profiles selectors re-render
        patch.profiles = new Map(state.profiles);
      }
    }

    set(patch);
  },

  addEvents: (events: NostrEvent[]) => {
    const state = get();
    let changed = false;
    let profilesChanged = false;

    for (const event of events) {
      if (state.eventsById.has(event.id)) continue;
      changed = true;

      state.eventsById.set(event.id, event);

      if (!state.eventsByKind.has(event.kind)) {
        state.eventsByKind.set(event.kind, new Map());
      }
      state.eventsByKind.get(event.kind)!.set(event.id, event);

      if (!state.eventsByAuthor.has(event.pubkey)) {
        state.eventsByAuthor.set(event.pubkey, new Map());
      }
      state.eventsByAuthor.get(event.pubkey)!.set(event.id, event);

      if (event.kind === NOSTR_KIND.METADATA) {
        const existing = state.profiles.get(event.pubkey);
        if (!existing || existing.fetchedAt < event.created_at * 1000) {
          state.profiles.set(
            event.pubkey,
            parseProfileContent(event.pubkey, event.content),
          );
          profilesChanged = true;
        }
      }
    }

    if (changed) {
      const patch: Partial<EventStore> = { totalEvents: state.eventsById.size };
      // Only signal profile change when metadata was actually updated.
      // Creates a new Map reference so subscribers re-render.
      if (profilesChanged) {
        patch.profiles = new Map(state.profiles);
      }
      set(patch);
    }
  },

  setConnectionStatus: (status) => set({ connectionStatus: status }),

  getAllEvents: () => [...get().eventsById.values()],

  getEventsByKind: (kind: number) => {
    const kindMap = get().eventsByKind.get(kind);
    return kindMap ? [...kindMap.values()] : [];
  },

  clear: () =>
    set({
      eventsById: new Map(),
      eventsByKind: new Map(),
      eventsByAuthor: new Map(),
      profiles: new Map(),
      totalEvents: 0,
    }),
}));
