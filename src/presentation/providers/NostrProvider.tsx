"use client";

import { useEffect, type ReactNode } from "react";
import { useNostrEvents } from "@/presentation/hooks/useNostrEvents";
import { useGraphData } from "@/presentation/hooks/useGraphData";
import { closePool } from "@/infra/nostr/relay-pool-impl";
import { subscriptionManager } from "@/infra/nostr/subscription-manager";

function NostrDataLoader() {
  useNostrEvents();
  useGraphData();

  // Relay pool cleanup on unmount — external system resource release
  useEffect(
    () => () => {
      subscriptionManager.closeAll();
      closePool();
    },
    [],
  );

  return null;
}

export function NostrProvider({ children }: { children: ReactNode }) {
  return (
    <>
      <NostrDataLoader />
      {children}
    </>
  );
}
