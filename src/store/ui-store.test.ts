import { describe, it, expect, beforeEach, vi } from "vitest";
import { useUIStore } from "./ui-store";

describe("ui-store", () => {
  beforeEach(() => {
    useUIStore.setState({
      selectedClusterId: null,
      selectedNodeId: null,
      isTimelinePanelOpen: false,
      hoveredNodeId: null,
      resetCameraFn: null,
      isZoomedIn: false,
    });
  });

  describe("selectNode", () => {
    it("sets selectedNodeId and opens timeline panel", () => {
      useUIStore.getState().selectNode("alice");
      const s = useUIStore.getState();
      expect(s.selectedNodeId).toBe("alice");
      expect(s.isTimelinePanelOpen).toBe(true);
    });

    it("clears selection and closes panel when null", () => {
      useUIStore.getState().selectNode("alice");
      useUIStore.getState().selectNode(null);
      const s = useUIStore.getState();
      expect(s.selectedNodeId).toBeNull();
      expect(s.isTimelinePanelOpen).toBe(false);
    });
  });

  describe("selectCluster", () => {
    it("sets selectedClusterId and opens timeline panel", () => {
      useUIStore.getState().selectCluster("c1");
      const s = useUIStore.getState();
      expect(s.selectedClusterId).toBe("c1");
      expect(s.isTimelinePanelOpen).toBe(true);
    });
  });

  describe("setHoveredNode", () => {
    it("sets hoveredNodeId", () => {
      useUIStore.getState().setHoveredNode("alice");
      expect(useUIStore.getState().hoveredNodeId).toBe("alice");
    });
  });

  describe("resetCamera", () => {
    it("calls registered resetCameraFn", () => {
      const fn = vi.fn();
      useUIStore.getState().setResetCameraFn(fn);
      useUIStore.getState().resetCamera();
      expect(fn).toHaveBeenCalledOnce();
    });

    it("clears selection and zoom state", () => {
      useUIStore.getState().selectNode("alice");
      useUIStore.getState().setZoomedIn(true);
      useUIStore.getState().setResetCameraFn(() => {});
      useUIStore.getState().resetCamera();
      const s = useUIStore.getState();
      expect(s.selectedNodeId).toBeNull();
      expect(s.selectedClusterId).toBeNull();
      expect(s.isTimelinePanelOpen).toBe(false);
      expect(s.isZoomedIn).toBe(false);
    });

    it("does not throw when no resetCameraFn registered", () => {
      expect(() => useUIStore.getState().resetCamera()).not.toThrow();
    });
  });

  describe("setZoomedIn", () => {
    it("sets isZoomedIn to true", () => {
      useUIStore.getState().setZoomedIn(true);
      expect(useUIStore.getState().isZoomedIn).toBe(true);
    });

    it("sets isZoomedIn back to false", () => {
      useUIStore.getState().setZoomedIn(true);
      useUIStore.getState().setZoomedIn(false);
      expect(useUIStore.getState().isZoomedIn).toBe(false);
    });
  });
});
