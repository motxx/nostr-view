"use client";

import { type ReactNode } from "react";
import { useNostrEvents } from "@/presentation/hooks/useNostrEvents";
import { useGraphData } from "@/presentation/hooks/useGraphData";

function NostrDataLoader() {
  useNostrEvents();
  useGraphData();
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
