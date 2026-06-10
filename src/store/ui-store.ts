import { create } from "zustand";
import type { ClusterMode } from "@/domain/services/cluster-strategy";

interface UIStore {
  /** Selected facet, or "auto" = highest-quality facet for current data */
  clusterStrategy: ClusterMode;
  /** User's own pubkey for "you are here" */
  myPubkey: string | null;
  selectedClusterId: string | null;
  selectedNodeId: string | null;
  isTimelinePanelOpen: boolean;
  hoveredNodeId: string | null;

  /** Registered by UniverseGraph — resets camera to overview position */
  resetCameraFn: (() => void) | null;
  /** Registered by UniverseGraph — flies camera to cluster centroid */
  flyToClusterFn: ((clusterId: string) => void) | null;
  /** Registered by UniverseGraph — reheats the force simulation */
  reheatSimulationFn: (() => void) | null;

  /** True when camera has moved from the default overview position */
  isCameraMoved: boolean;

  /** Time range filter [start, end] in unix seconds; null = live (no filter) */
  timeRange: [number, number] | null;
  /** True when in live mode (following real-time) */
  isLive: boolean;

  /** Mobile sidebar drawer open state */
  isSidebarOpen: boolean;

  selectCluster: (clusterId: string | null) => void;
  selectNode: (nodeId: string | null) => void;
  setTimelinePanelOpen: (open: boolean) => void;
  setHoveredNode: (nodeId: string | null) => void;
  setResetCameraFn: (fn: (() => void) | null) => void;
  setFlyToClusterFn: (fn: ((clusterId: string) => void) | null) => void;
  setReheatSimulationFn: (fn: (() => void) | null) => void;
  reheatSimulation: () => void;
  setMyPubkey: (pubkey: string | null) => void;
  setClusterStrategy: (strategy: ClusterMode) => void;
  setCameraMoved: (moved: boolean) => void;
  resetCamera: () => void;
  setTimeRange: (range: [number, number] | null) => void;
  goLive: () => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
}

export const useUIStore = create<UIStore>((set, get) => ({
  clusterStrategy: "auto" as ClusterMode,
  myPubkey: null,
  selectedClusterId: null,
  selectedNodeId: null,
  isTimelinePanelOpen: false,
  hoveredNodeId: null,
  resetCameraFn: null,
  flyToClusterFn: null,
  reheatSimulationFn: null,
  isCameraMoved: false,
  timeRange: null,
  isLive: true,
  isSidebarOpen: false,

  selectCluster: (clusterId) =>
    set({
      selectedClusterId: clusterId,
      selectedNodeId: null,
      isTimelinePanelOpen: clusterId !== null,
      ...(clusterId !== null ? { isSidebarOpen: true } : {}),
    }),

  selectNode: (nodeId) =>
    set((state) => ({
      selectedNodeId: nodeId,
      isTimelinePanelOpen:
        nodeId !== null || state.selectedClusterId !== null,
      ...(nodeId !== null ? { isSidebarOpen: true } : {}),
    })),

  setTimelinePanelOpen: (open) =>
    set({
      isTimelinePanelOpen: open,
      ...(open ? {} : { selectedClusterId: null, selectedNodeId: null }),
    }),

  setHoveredNode: (nodeId) => set({ hoveredNodeId: nodeId }),

  setResetCameraFn: (fn) => set({ resetCameraFn: fn }),
  setFlyToClusterFn: (fn) => set({ flyToClusterFn: fn }),
  setReheatSimulationFn: (fn) => set({ reheatSimulationFn: fn }),
  reheatSimulation: () => get().reheatSimulationFn?.(),

  setMyPubkey: (pubkey) => set({ myPubkey: pubkey }),

  setClusterStrategy: (strategy) =>
    set({
      clusterStrategy: strategy,
      selectedClusterId: null,
      selectedNodeId: null,
      isTimelinePanelOpen: false,
    }),

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

  setTimeRange: (range) =>
    set({ timeRange: range, isLive: range === null }),

  goLive: () => set({ timeRange: null, isLive: true }),

  toggleSidebar: () => set((s) => ({ isSidebarOpen: !s.isSidebarOpen })),
  setSidebarOpen: (open) => set({ isSidebarOpen: open }),
}));
