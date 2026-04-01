"use client";

import { type ReactNode } from "react";
import { useNostrEvents } from "@/presentation/hooks/useNostrEvents";
import { useGraphData } from "@/presentation/hooks/useGraphData";
import { useClusterNaming } from "@/presentation/hooks/useClusterNaming";

function NostrDataLoader() {
  useNostrEvents();
  useGraphData();
  useClusterNaming();
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
