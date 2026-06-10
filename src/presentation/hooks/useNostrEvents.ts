"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useEventStore } from "@/store/event-store";
import { useActivityStore } from "@/store/activity-store";
import {
  fetchRecentNotes,
  fetchInteractions,
  fetchProfiles,
  fetchZapsForAuthors,
  subscribeLiveNotes,
} from "@/infra/nostr/event-fetcher";
import { closePool } from "@/infra/nostr/relay-pool-impl";
import { subscriptionManager } from "@/infra/nostr/subscription-manager";
import { NOSTR_KIND } from "@/lib/nostr-kinds";

/**
 * Fetches initial Nostr events and profiles via TanStack Query.
 *
 * The single useEffect is for the live WebSocket subscription — the
 * canonical external-system-sync use-case that Dan Abramov endorses.
 * Relay pool cleanup is co-located here (same external system lifecycle).
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

      const activities = allEvents
        .filter((e) => e.kind === NOSTR_KIND.TEXT_NOTE)
        .map((e) => ({ pubkey: e.pubkey, createdAt: e.created_at }));
      if (activities.length > 0) {
        useActivityStore.getState().updateActivities(activities);
      }

      return [
        ...new Set(
          allEvents
            .filter((e) => e.kind === NOSTR_KIND.TEXT_NOTE)
            .map((e) => e.pubkey),
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

  // ── Zap receipts for visible authors (depends on initial data) ──
  // Targeted #p query: zap edges are the strongest interaction signal
  // (NIP-57), and the global window query alone misses most of them.
  useQuery({
    queryKey: ["nostr", "zaps", authorPubkeys],
    queryFn: async () => {
      const since = Math.floor(Date.now() / 1000) - 2 * 60 * 60;
      const zaps = await fetchZapsForAuthors(authorPubkeys!, since);
      useEventStore.getState().addEvents(zaps);
      return zaps.length;
    },
    enabled: !!authorPubkeys && authorPubkeys.length > 0,
    staleTime: Infinity,
  });

  // ── Live subscription + relay pool lifecycle ──
  // This is the ONE useEffect in the entire app. It synchronizes with
  // an external system (WebSocket relay connection). Per Dan Abramov:
  // "Effects let you synchronize your component with an external system."
  useEffect(() => {
    // Buffer incoming events and flush as a batch every 200ms.
    // This reduces per-event Map copies and store updates from N to 1.
    let buffer: import("@/domain/entities/nostr-event").NostrEvent[] = [];
    let flushTimer: ReturnType<typeof setTimeout> | null = null;

    const flush = () => {
      flushTimer = null;
      if (buffer.length === 0) return;
      const batch = buffer;
      buffer = [];

      useEventStore.getState().addEvents(batch);

      const textNotes = batch.filter((e) => e.kind === NOSTR_KIND.TEXT_NOTE);
      if (textNotes.length > 0) {
        useActivityStore
          .getState()
          .recordLiveEvents(
            textNotes.map((e) => ({ pubkey: e.pubkey, createdAt: e.created_at })),
          );
      }
    };

    const sub = subscribeLiveNotes(
      (event) => {
        buffer.push(event);
        if (!flushTimer) {
          flushTimer = setTimeout(flush, 200);
        }
      },
      () => useEventStore.getState().setConnectionStatus("connected"),
    );
    subscriptionManager.add("live-notes", sub);

    return () => {
      if (flushTimer) clearTimeout(flushTimer);
      flush(); // flush remaining events
      subscriptionManager.closeAll();
      closePool();
    };
  }, []);
}
