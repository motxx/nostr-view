import { create } from "zustand";
import type { ClusterStrategy } from "@/domain/services/cluster-strategy";

interface UIStore {
  clusterStrategy: ClusterStrategy;
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

  selectCluster: (clusterId: string | null) => void;
  selectNode: (nodeId: string | null) => void;
  setTimelinePanelOpen: (open: boolean) => void;
  setHoveredNode: (nodeId: string | null) => void;
  setResetCameraFn: (fn: (() => void) | null) => void;
  setFlyToClusterFn: (fn: ((clusterId: string) => void) | null) => void;
  setReheatSimulationFn: (fn: (() => void) | null) => void;
  reheatSimulation: () => void;
  setMyPubkey: (pubkey: string | null) => void;
  setClusterStrategy: (strategy: ClusterStrategy) => void;
  setCameraMoved: (moved: boolean) => void;
  resetCamera: () => void;
  setTimeRange: (range: [number, number] | null) => void;
  goLive: () => void;
}

export const useUIStore = create<UIStore>((set, get) => ({
  clusterStrategy: "topic" as ClusterStrategy,
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
}));
