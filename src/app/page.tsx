"use client";

import dynamic from "next/dynamic";
import { NostrProvider } from "@/presentation/providers/NostrProvider";
import { Header } from "@/presentation/components/layout/Header";
import { StatusBar } from "@/presentation/components/layout/StatusBar";
import { NodeDetailCard } from "@/presentation/components/graph/NodeDetailCard";
import { ResetViewButton } from "@/presentation/components/graph/ResetViewButton";
import { ClusterOverviewPanel } from "@/presentation/components/graph/ClusterOverviewPanel";
import { TimelineScrubber } from "@/presentation/components/graph/TimelineScrubber";
import { TimelinePanel } from "@/presentation/components/timeline/TimelinePanel";
import { useUIStore } from "@/store/ui-store";

const UniverseGraph = dynamic(
  () =>
    import("@/presentation/components/graph/UniverseGraph").then(
      (mod) => mod.UniverseGraph,
    ),
  { ssr: false },
);

export default function Home() {
  const isTimelinePanelOpen = useUIStore((s) => s.isTimelinePanelOpen);

  return (
    <NostrProvider>
      <div className="relative w-screen h-screen overflow-hidden flex flex-col">
        <Header />
        {/* pt-[52px] = Header height, pb-[28px] = StatusBar height */}
        <div className="flex flex-1 min-h-0 pt-[52px] pb-[28px]">
          {/* 3D graph — fills remaining space */}
          <div className="relative flex-1">
            <UniverseGraph />
            <NodeDetailCard />
            <ResetViewButton />
            <TimelineScrubber />
          </div>
          {/* Right sidebar — switches between overview and timeline */}
          {isTimelinePanelOpen ? <TimelinePanel /> : <ClusterOverviewPanel />}
        </div>
        <StatusBar />
      </div>
    </NostrProvider>
  );
}
