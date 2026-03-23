"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useEventStore } from "@/store/event-store";
import { useActivityStore } from "@/store/activity-store";
import {
  fetchRecentNotes,
  fetchInteractions,
  fetchProfiles,
  subscribeLiveNotes,
} from "@/infra/nostr/event-fetcher";
import { subscriptionManager } from "@/infra/nostr/subscription-manager";
import { NOSTR_KIND } from "@/lib/nostr-kinds";

/**
 * Fetches initial Nostr events and profiles via TanStack Query.
 * The only useEffect is for the live WebSocket subscription
 * (external system sync — the one valid use-case).
 */
export function useNostrEvents() {
  // ── Initial event fetch ──
  const { data: authorPubkeys } = useQuery({
    queryKey: ["nostr", "initial-events"],
    queryFn: async () => {
      useEventStore.getState().setConnectionStatus("connecting");

      const since = Math.floor(Date.now() / 1000) - 2 * 60 * 60;
      const [notes, interactions] = await Promise.allSettled([
        fetchRecentNotes(since, 300),
        fetchInteractions(since, 300),
      ]);

      const allEvents = [
        ...(notes.status === "fulfilled" ? notes.value : []),
        ...(interactions.status === "fulfilled" ? interactions.value : []),
      ];

      useEventStore.getState().addEvents(allEvents);
      useEventStore
        .getState()
        .setConnectionStatus(allEvents.length > 0 ? "connected" : "error");

      // Feed activity store
      const activities = allEvents
        .filter((e) => e.kind === NOSTR_KIND.TEXT_NOTE)
        .map((e) => ({ pubkey: e.pubkey, createdAt: e.created_at }));
      if (activities.length > 0) {
        useActivityStore.getState().updateActivities(activities);
      }

      // Return pubkeys for dependent profile query
      return [
        ...new Set(
          allEvents.filter((e) => e.kind === NOSTR_KIND.TEXT_NOTE).map((e) => e.pubkey),
        ),
      ].slice(0, 200);
    },
    staleTime: Infinity,
  });

  // ── Profile fetch (depends on initial data) ──
  useQuery({
    queryKey: ["nostr", "profiles", authorPubkeys],
    queryFn: async () => {
      const profiles = await fetchProfiles(authorPubkeys!);
      useEventStore.getState().addEvents(profiles);
      return profiles.length;
    },
    enabled: !!authorPubkeys && authorPubkeys.length > 0,
    staleTime: Infinity,
  });

  // ── Live subscription — external system sync (WebSocket) ──
  useEffect(() => {
    const sub = subscribeLiveNotes(
      (event) => {
        useEventStore.getState().addEvent(event);
        if (event.kind === NOSTR_KIND.TEXT_NOTE) {
          useActivityStore
            .getState()
            .updateActivity(event.pubkey, event.created_at);
        }
      },
      () => useEventStore.getState().setConnectionStatus("connected"),
    );
    subscriptionManager.add("live-notes", sub);
    return () => subscriptionManager.close("live-notes");
  }, []);
}
