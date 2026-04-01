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
    ? "SIGNAL FEED // CLUSTER"
    : selectedNodeId
      ? "SIGNAL FEED // SUBJECT"
      : "SIGNAL FEED";

  if (!isOpen) return null;

  return (
    <Sheet open onOpenChange={(open) => { if (!open) handleClose(); }}>
      <SheetContent
        side="right"
        className="w-full max-w-[400px] sm:max-w-[450px] bg-black/95 border-[#00ff41]/15 p-0"
      >
        <SheetHeader className="px-4 py-2 border-b border-[#00ff41]/15 bg-[#00ff41]/5">
          <SheetTitle className="font-mono text-[10px] text-[#00ff41]/60 uppercase tracking-[0.2em]">
            {title}
          </SheetTitle>
        </SheetHeader>
        <div className="h-[calc(100%-44px)]">
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
