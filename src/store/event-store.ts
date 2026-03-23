import { create } from "zustand";
import type { NostrEvent } from "@/domain/entities/nostr-event";
import type { NostrProfile } from "@/domain/entities/nostr-profile";
import { parseProfileContent } from "@/domain/entities/nostr-profile";
import { NOSTR_KIND } from "@/lib/nostr-kinds";

interface EventStore {
  // Indexed events
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

    const newEventsById = new Map(state.eventsById);
    newEventsById.set(event.id, event);

    const newEventsByKind = new Map(state.eventsByKind);
    if (!newEventsByKind.has(event.kind)) {
      newEventsByKind.set(event.kind, new Map());
    }
    newEventsByKind.get(event.kind)!.set(event.id, event);

    const newEventsByAuthor = new Map(state.eventsByAuthor);
    if (!newEventsByAuthor.has(event.pubkey)) {
      newEventsByAuthor.set(event.pubkey, new Map());
    }
    newEventsByAuthor.get(event.pubkey)!.set(event.id, event);

    // Handle profile events
    const newProfiles = new Map(state.profiles);
    if (event.kind === NOSTR_KIND.METADATA) {
      const existing = newProfiles.get(event.pubkey);
      if (!existing || existing.fetchedAt < event.created_at * 1000) {
        newProfiles.set(
          event.pubkey,
          parseProfileContent(event.pubkey, event.content),
        );
      }
    }

    set({
      eventsById: newEventsById,
      eventsByKind: newEventsByKind,
      eventsByAuthor: newEventsByAuthor,
      profiles: newProfiles,
      totalEvents: newEventsById.size,
    });
  },

  addEvents: (events: NostrEvent[]) => {
    const state = get();
    const newEventsById = new Map(state.eventsById);
    const newEventsByKind = new Map(state.eventsByKind);
    const newEventsByAuthor = new Map(state.eventsByAuthor);
    const newProfiles = new Map(state.profiles);

    let changed = false;

    for (const event of events) {
      if (newEventsById.has(event.id)) continue;
      changed = true;

      newEventsById.set(event.id, event);

      if (!newEventsByKind.has(event.kind)) {
        newEventsByKind.set(event.kind, new Map());
      }
      newEventsByKind.get(event.kind)!.set(event.id, event);

      if (!newEventsByAuthor.has(event.pubkey)) {
        newEventsByAuthor.set(event.pubkey, new Map());
      }
      newEventsByAuthor.get(event.pubkey)!.set(event.id, event);

      if (event.kind === NOSTR_KIND.METADATA) {
        const existing = newProfiles.get(event.pubkey);
        if (!existing || existing.fetchedAt < event.created_at * 1000) {
          newProfiles.set(
            event.pubkey,
            parseProfileContent(event.pubkey, event.content),
          );
        }
      }
    }

    if (changed) {
      set({
        eventsById: newEventsById,
        eventsByKind: newEventsByKind,
        eventsByAuthor: newEventsByAuthor,
        profiles: newProfiles,
        totalEvents: newEventsById.size,
      });
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
