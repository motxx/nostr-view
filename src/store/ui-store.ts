import { create } from "zustand";

interface UIStore {
  selectedClusterId: string | null;
  selectedNodeId: string | null;
  isTimelinePanelOpen: boolean;
  hoveredNodeId: string | null;

  /** Registered by UniverseGraph — resets camera to overview position */
  resetCameraFn: (() => void) | null;
  /** Registered by UniverseGraph — flies camera to cluster centroid */
  flyToClusterFn: ((clusterId: string) => void) | null;

  /** True when camera has moved from the default overview position */
  isCameraMoved: boolean;

  selectCluster: (clusterId: string | null) => void;
  selectNode: (nodeId: string | null) => void;
  setTimelinePanelOpen: (open: boolean) => void;
  setHoveredNode: (nodeId: string | null) => void;
  setResetCameraFn: (fn: (() => void) | null) => void;
  setFlyToClusterFn: (fn: ((clusterId: string) => void) | null) => void;
  setCameraMoved: (moved: boolean) => void;
  resetCamera: () => void;
}

export const useUIStore = create<UIStore>((set, get) => ({
  selectedClusterId: null,
  selectedNodeId: null,
  isTimelinePanelOpen: false,
  hoveredNodeId: null,
  resetCameraFn: null,
  flyToClusterFn: null,
  isCameraMoved: false,

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
  setFlyToClusterFn: (fn) => set({ flyToClusterFn: fn }),

  setCameraMoved: (moved) => {
    if (get().isCameraMoved !== moved) set({ isCameraMoved: moved });
  },

  resetCamera: () => {
    const fn = get().resetCameraFn;
    if (fn) fn();
    set({
      selectedClusterId: null,
      selectedNodeId: null,
      isTimelinePanelOpen: false,
      isCameraMoved: false,
    });
  },
}));
