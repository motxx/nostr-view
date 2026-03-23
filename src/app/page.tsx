"use client";

import dynamic from "next/dynamic";
import { NostrProvider } from "@/presentation/providers/NostrProvider";
import { Header } from "@/presentation/components/layout/Header";
import { StatusBar } from "@/presentation/components/layout/StatusBar";
import { NodeTooltip } from "@/presentation/components/graph/NodeTooltip";
import { NodeDetailCard } from "@/presentation/components/graph/NodeDetailCard";
import { ResetViewButton } from "@/presentation/components/graph/ResetViewButton";
import { GraphControls } from "@/presentation/components/graph/GraphControls";
import { TimelinePanel } from "@/presentation/components/timeline/TimelinePanel";
import { LiveFeed } from "@/presentation/components/timeline/LiveFeed";

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
      <div className="relative w-screen h-screen overflow-hidden">
        <Header />
        <UniverseGraph />
        <NodeTooltip />
        <NodeDetailCard />
        <ResetViewButton />
        <GraphControls />
        <LiveFeed />
        <TimelinePanel />
        <StatusBar />
      </div>
    </NostrProvider>
  );
}
