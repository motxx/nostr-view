import { describe, it, expect, beforeEach } from "vitest";
import { useEventStore } from "./event-store";
import { NOSTR_KIND } from "@/lib/nostr-kinds";
import type { NostrEvent } from "@/domain/entities/nostr-event";

function makeEvent(overrides: Partial<NostrEvent> = {}): NostrEvent {
  return {
    id: "ev-" + Math.random().toString(36).slice(2, 8),
    pubkey: "pk1",
    created_at: 1000,
    kind: NOSTR_KIND.TEXT_NOTE,
    tags: [],
    content: "hello",
    sig: "sig",
    ...overrides,
  };
}

describe("event-store", () => {
  beforeEach(() => {
    useEventStore.getState().clear();
  });

  describe("addEvent", () => {
    it("adds an event and increments totalEvents", () => {
      const ev = makeEvent();
      useEventStore.getState().addEvent(ev);
      expect(useEventStore.getState().totalEvents).toBe(1);
      expect(useEventStore.getState().eventsById.get(ev.id)).toBe(ev);
    });

    it("deduplicates by event id", () => {
      const ev = makeEvent({ id: "dup" });
      useEventStore.getState().addEvent(ev);
      useEventStore.getState().addEvent(ev);
      expect(useEventStore.getState().totalEvents).toBe(1);
    });

    it("indexes by kind", () => {
      const note = makeEvent({ kind: NOSTR_KIND.TEXT_NOTE });
      const reaction = makeEvent({ kind: NOSTR_KIND.REACTION });
      useEventStore.getState().addEvent(note);
      useEventStore.getState().addEvent(reaction);
      expect(useEventStore.getState().getEventsByKind(NOSTR_KIND.TEXT_NOTE)).toHaveLength(1);
      expect(useEventStore.getState().getEventsByKind(NOSTR_KIND.REACTION)).toHaveLength(1);
    });

    it("indexes by author", () => {
      const ev1 = makeEvent({ pubkey: "alice" });
      const ev2 = makeEvent({ pubkey: "alice" });
      const ev3 = makeEvent({ pubkey: "bob" });
      useEventStore.getState().addEvent(ev1);
      useEventStore.getState().addEvent(ev2);
      useEventStore.getState().addEvent(ev3);
      expect(useEventStore.getState().eventsByAuthor.get("alice")?.size).toBe(2);
      expect(useEventStore.getState().eventsByAuthor.get("bob")?.size).toBe(1);
    });

    it("parses metadata events into profiles", () => {
      const ev = makeEvent({
        kind: NOSTR_KIND.METADATA,
        pubkey: "alice",
        content: JSON.stringify({ name: "Alice", display_name: "Alice W" }),
      });
      useEventStore.getState().addEvent(ev);
      const profile = useEventStore.getState().profiles.get("alice");
      expect(profile?.name).toBe("Alice");
      expect(profile?.displayName).toBe("Alice W");
    });
  });

  describe("addEvents (batch)", () => {
    it("adds multiple events at once", () => {
      const events = [makeEvent(), makeEvent(), makeEvent()];
      useEventStore.getState().addEvents(events);
      expect(useEventStore.getState().totalEvents).toBe(3);
    });

    it("skips already-existing events", () => {
      const ev = makeEvent({ id: "existing" });
      useEventStore.getState().addEvent(ev);
      useEventStore.getState().addEvents([ev, makeEvent()]);
      expect(useEventStore.getState().totalEvents).toBe(2);
    });
  });

  describe("getAllEvents", () => {
    it("returns all events as array", () => {
      useEventStore.getState().addEvents([makeEvent(), makeEvent()]);
      expect(useEventStore.getState().getAllEvents()).toHaveLength(2);
    });
  });

  describe("clear", () => {
    it("resets all state", () => {
      useEventStore.getState().addEvents([makeEvent(), makeEvent()]);
      useEventStore.getState().clear();
      expect(useEventStore.getState().totalEvents).toBe(0);
      expect(useEventStore.getState().profiles.size).toBe(0);
    });
  });

  describe("connectionStatus", () => {
    it("defaults to connecting", () => {
      expect(useEventStore.getState().connectionStatus).toBe("connecting");
    });

    it("can be set", () => {
      useEventStore.getState().setConnectionStatus("connected");
      expect(useEventStore.getState().connectionStatus).toBe("connected");
    });
  });
});
