"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useUIStore } from "@/store/ui-store";
import { ClusterTimeline } from "./ClusterTimeline";
import { NodeTimeline } from "./NodeTimeline";

export function TimelinePanel() {
  const isOpen = useUIStore((s) => s.isTimelinePanelOpen);
  const selectedClusterId = useUIStore((s) => s.selectedClusterId);
  const selectedNodeId = useUIStore((s) => s.selectedNodeId);

  const handleClose = () => {
    useUIStore.getState().setTimelinePanelOpen(false);
  };

  const title = selectedClusterId
    ? "Cluster Timeline"
    : selectedNodeId
      ? "User Timeline"
      : "Timeline";

  // Don't render Sheet at all when closed — prevents onOpenChange race conditions
  if (!isOpen) return null;

  return (
    <Sheet open onOpenChange={(open) => { if (!open) handleClose(); }}>
      <SheetContent
        side="right"
        className="w-full max-w-[400px] sm:max-w-[450px] bg-[#0a0a12]/95 border-white/10 p-0"
      >
        <SheetHeader className="px-4 py-3 border-b border-white/10">
          <SheetTitle className="font-mono text-sm text-white/80">
            {title}
          </SheetTitle>
        </SheetHeader>
        <div className="h-[calc(100%-60px)]">
          {selectedClusterId ? (
            <ClusterTimeline clusterId={selectedClusterId} />
          ) : selectedNodeId ? (
            <NodeTimeline pubkey={selectedNodeId} />
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
