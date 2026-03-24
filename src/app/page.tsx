"use client";

import dynamic from "next/dynamic";
import { NostrProvider } from "@/presentation/providers/NostrProvider";
import { Header } from "@/presentation/components/layout/Header";
import { StatusBar } from "@/presentation/components/layout/StatusBar";
import { NodeDetailCard } from "@/presentation/components/graph/NodeDetailCard";
import { ResetViewButton } from "@/presentation/components/graph/ResetViewButton";
import { ClusterOverviewPanel } from "@/presentation/components/graph/ClusterOverviewPanel";
import { TimelinePanel } from "@/presentation/components/timeline/TimelinePanel";

const UniverseGraph = dynamic(
  () =>
    import("@/presentation/components/graph/UniverseGraph").then(
      (mod) => mod.UniverseGraph,
    ),
  { ssr: false },
);

export default function Home() {
  return (
    <NostrProvider>
      <div className="relative w-screen h-screen overflow-hidden flex flex-col">
        <Header />
        <div className="flex flex-1 min-h-0">
          {/* 3D graph — fills remaining space */}
          <div className="relative flex-1">
            <UniverseGraph />
            <NodeDetailCard />
            <ResetViewButton />
          </div>
          {/* Cluster overview — fixed right panel */}
          <ClusterOverviewPanel />
        </div>
        <StatusBar />
        <TimelinePanel />
      </div>
    </NostrProvider>
  );
}
