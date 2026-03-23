import { create } from "zustand";

interface UIStore {
  selectedClusterId: string | null;
  selectedNodeId: string | null;
  isTimelinePanelOpen: boolean;
  hoveredNodeId: string | null;

  /** Registered by UniverseGraph — resets camera to overview position */
  resetCameraFn: (() => void) | null;

  /** True when the camera is zoomed in past the default overview distance */
  isZoomedIn: boolean;

  selectCluster: (clusterId: string | null) => void;
  selectNode: (nodeId: string | null) => void;
  setTimelinePanelOpen: (open: boolean) => void;
  setHoveredNode: (nodeId: string | null) => void;
  setResetCameraFn: (fn: (() => void) | null) => void;
  setZoomedIn: (zoomed: boolean) => void;
  resetCamera: () => void;
}

export const useUIStore = create<UIStore>((set, get) => ({
  selectedClusterId: null,
  selectedNodeId: null,
  isTimelinePanelOpen: false,
  hoveredNodeId: null,
  resetCameraFn: null,
  isZoomedIn: false,

  selectCluster: (clusterId) =>
    set({
      selectedClusterId: clusterId,
      isTimelinePanelOpen: clusterId !== null,
    }),

  selectNode: (nodeId) =>
    set({
      selectedNodeId: nodeId,
      isTimelinePanelOpen: nodeId !== null,
    }),

  setTimelinePanelOpen: (open) =>
    set({
      isTimelinePanelOpen: open,
      ...(open ? {} : { selectedClusterId: null, selectedNodeId: null }),
    }),

  setHoveredNode: (nodeId) => set({ hoveredNodeId: nodeId }),

  setResetCameraFn: (fn) => set({ resetCameraFn: fn }),

  setZoomedIn: (zoomed) => {
    if (get().isZoomedIn !== zoomed) set({ isZoomedIn: zoomed });
  },

  resetCamera: () => {
    const fn = get().resetCameraFn;
    if (fn) fn();
    set({
      selectedClusterId: null,
      selectedNodeId: null,
      isTimelinePanelOpen: false,
      isZoomedIn: false,
    });
  },
}));
