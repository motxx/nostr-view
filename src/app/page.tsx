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

function SidebarToggle() {
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const isSidebarOpen = useUIStore((s) => s.isSidebarOpen);

  if (isSidebarOpen) return null;

  return (
    <button
      onClick={toggleSidebar}
      className="fixed bottom-10 right-3 z-[100] md:hidden bg-black/90 backdrop-blur-sm border border-[#00ff41]/20 rounded-full w-10 h-10 flex items-center justify-center text-[#00ff41]/60 hover:text-[#00ff41] hover:border-[#00ff41]/40 transition-colors"
      aria-label="Open sidebar"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </button>
  );
}

export default function Home() {
  const isTimelinePanelOpen = useUIStore((s) => s.isTimelinePanelOpen);

  return (
    <NostrProvider>
      <div className="relative w-screen h-screen overflow-hidden flex flex-col">
        <Header />
        {/* pt-[42px]/pt-[52px] = Header height, pb-[28px] = StatusBar height */}
        <div className="flex flex-1 min-h-0 pt-[42px] md:pt-[52px] pb-[28px]">
          {/* 3D graph — fills remaining space */}
          <div className="relative flex-1">
            <UniverseGraph />
            <NodeDetailCard />
            <ResetViewButton />
            <TimelineScrubber />
          </div>
          {/* Sidebar — single instance, SidebarPanel handles mobile drawer vs desktop static */}
          {isTimelinePanelOpen ? <TimelinePanel /> : <ClusterOverviewPanel />}
        </div>
        <StatusBar />
        <SidebarToggle />
      </div>
    </NostrProvider>
  );
}
