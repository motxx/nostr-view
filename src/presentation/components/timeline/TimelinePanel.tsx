"use client";

import { useUIStore } from "@/store/ui-store";
import { SidebarPanel } from "@/presentation/components/layout/SidebarPanel";
import { ClusterTimeline } from "./ClusterTimeline";
import { NodeTimeline } from "./NodeTimeline";

export function TimelinePanel() {
  const selectedClusterId = useUIStore((s) => s.selectedClusterId);
  const selectedNodeId = useUIStore((s) => s.selectedNodeId);

  const handleBack = () => {
    useUIStore.getState().setTimelinePanelOpen(false);
  };

  const title = selectedClusterId
    ? "signal feed // cluster"
    : "signal feed // subject";

  return (
    <SidebarPanel title={title} onBack={handleBack}>
      {selectedClusterId ? (
        <ClusterTimeline clusterId={selectedClusterId} />
      ) : selectedNodeId ? (
        <NodeTimeline pubkey={selectedNodeId} />
      ) : null}
    </SidebarPanel>
  );
}
