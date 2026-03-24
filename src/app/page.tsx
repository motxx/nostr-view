"use client";

import dynamic from "next/dynamic";
import { NostrProvider } from "@/presentation/providers/NostrProvider";
import { Header } from "@/presentation/components/layout/Header";
import { StatusBar } from "@/presentation/components/layout/StatusBar";
import { NodeDetailCard } from "@/presentation/components/graph/NodeDetailCard";
import { ResetViewButton } from "@/presentation/components/graph/ResetViewButton";
import { GraphControls } from "@/presentation/components/graph/GraphControls";
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
      <div className="relative w-screen h-screen overflow-hidden">
        <Header />
        <UniverseGraph />
        <NodeDetailCard />
        <ResetViewButton />
        <GraphControls />
        <TimelinePanel />
        <StatusBar />
      </div>
    </NostrProvider>
  );
}
