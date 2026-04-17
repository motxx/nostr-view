import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useGraphStore } from "@/store/graph-store";
import { useUIStore } from "@/store/ui-store";
import { isEdgeActive, type EdgeActiveContext } from "@/lib/graph-math";
import { buildConnectedSet, buildClusterMemberSet } from "./graph-helpers";
import type { SimState } from "./graph-types";

/** Cached UI state to avoid getState() calls every frame */
interface CachedUIState {
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
  selectedClusterId: string | null;
}

export function GraphLinks({ simState }: { simState: React.RefObject<SimState | null> }) {
  const lineRef = useRef<THREE.LineSegments>(null);

  // Subscribe to UI store changes via ref
  const uiRef = useRef<CachedUIState>({
    selectedNodeId: useUIStore.getState().selectedNodeId,
    hoveredNodeId: useUIStore.getState().hoveredNodeId,
    selectedClusterId: useUIStore.getState().selectedClusterId,
  });
  useEffect(() => useUIStore.subscribe((state) => {
    uiRef.current.selectedNodeId = state.selectedNodeId;
    uiRef.current.hoveredNodeId = state.hoveredNodeId;
    uiRef.current.selectedClusterId = state.selectedClusterId;
  }), []);

  // Cache computed sets to avoid rebuilding every frame
  const prevActiveIdRef = useRef<string | null>(null);
  const prevSelectedClusterIdRef = useRef<string | null>(null);
  const connectedCacheRef = useRef<Set<string> | null>(null);
  const clusterMembersCacheRef = useRef<Set<string> | null>(null);
  const clusterColorCacheRef = useRef<THREE.Color | null>(null);

  // Cache cluster color map from graph store + invalidate connection cache on edge changes
  const clusterColorMapRef = useRef(new Map<string, string>());
  useEffect(() => useGraphStore.subscribe((state) => {
    const map = clusterColorMapRef.current;
    map.clear();
    for (const c of state.clusters) map.set(c.id, c.color);
    // Invalidate connected/cluster caches so they rebuild with new edges
    prevActiveIdRef.current = null;
    prevSelectedClusterIdRef.current = null;
  }), []);

  const maxLinks = 2000;
  const positions = useMemo(() => new Float32Array(maxLinks * 6), []);
  const colors = useMemo(() => new Float32Array(maxLinks * 6), []);
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return g;
  }, [positions, colors]);

  useFrame(() => {
    const s = simState.current;
    if (!s || !lineRef.current) return;

    // Three.js BufferGeometry requires mutating the underlying Float32Array
    // every frame. This is the standard R3F pattern — the arrays are our own
    // typed buffers passed to useMemo, not React-managed state.
    /* eslint-disable react-hooks/immutability -- Three.js buffer mutation in useFrame */
    const posAttr = geom.attributes.position as THREE.BufferAttribute;
    const colAttr = geom.attributes.color as THREE.BufferAttribute;
    const pos = posAttr.array as Float32Array;
    const col = colAttr.array as Float32Array;

    // Read cached UI state (no getState() call)
    const ui = uiRef.current;
    const activeId = ui.selectedNodeId ?? ui.hoveredNodeId;
    const selectedClusterId = ui.selectedClusterId;

    // Rebuild connected set only when activeId changes
    if (activeId !== prevActiveIdRef.current) {
      prevActiveIdRef.current = activeId;
      connectedCacheRef.current = activeId ? buildConnectedSet(activeId) : null;
    }
    const connected = connectedCacheRef.current;

    // Rebuild cluster members only when selectedClusterId changes
    if (selectedClusterId !== prevSelectedClusterIdRef.current) {
      prevSelectedClusterIdRef.current = selectedClusterId;
      if (!activeId && selectedClusterId) {
        clusterMembersCacheRef.current = buildClusterMemberSet(selectedClusterId);
        const hex = clusterColorMapRef.current.get(selectedClusterId) ?? "#00ff41";
        clusterColorCacheRef.current = new THREE.Color(hex);
      } else {
        clusterMembersCacheRef.current = null;
        clusterColorCacheRef.current = null;
      }
    }
    const clusterMembers = (!activeId && selectedClusterId) ? clusterMembersCacheRef.current : null;
    const clusterColor = clusterMembers ? clusterColorCacheRef.current : null;
    const edgeCtx: EdgeActiveContext = {
      connectedSet: connected,
      activeNodeId: activeId,
      clusterMemberSet: clusterMembers,
    };

    for (let i = 0; i < s.links.length; i++) {
      const link = s.links[i];
      const src = typeof link.source === "object" ? link.source : s.nodeMap.get(String(link.source));
      const tgt = typeof link.target === "object" ? link.target : s.nodeMap.get(String(link.target));
      if (!src || !tgt) continue;

      const srcId = String(src.id);
      const tgtId = String(tgt.id);
      const { isActive, isClusterEdge } = isEdgeActive(srcId, tgtId, edgeCtx);

      if (isActive) {
        // Show: real positions + bright color (cluster color or green)
        pos[i * 6] = src.x ?? 0;
        pos[i * 6 + 1] = src.y ?? 0;
        pos[i * 6 + 2] = src.z ?? 0;
        pos[i * 6 + 3] = tgt.x ?? 0;
        pos[i * 6 + 4] = tgt.y ?? 0;
        pos[i * 6 + 5] = tgt.z ?? 0;
        const cr = isClusterEdge && clusterColor ? clusterColor.r : 0.0;
        const cg = isClusterEdge && clusterColor ? clusterColor.g : 1.0;
        const cb = isClusterEdge && clusterColor ? clusterColor.b : 0.25;
        col[i * 6] = cr; col[i * 6 + 1] = cg; col[i * 6 + 2] = cb;
        col[i * 6 + 3] = cr; col[i * 6 + 4] = cg; col[i * 6 + 5] = cb;
      } else {
        // Hide: collapse to zero-length line (no draw artifact)
        pos[i * 6] = 0; pos[i * 6 + 1] = 0; pos[i * 6 + 2] = 0;
        pos[i * 6 + 3] = 0; pos[i * 6 + 4] = 0; pos[i * 6 + 5] = 0;
        col[i * 6] = 0; col[i * 6 + 1] = 0; col[i * 6 + 2] = 0;
        col[i * 6 + 3] = 0; col[i * 6 + 4] = 0; col[i * 6 + 5] = 0;
      }
    }

    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    geom.setDrawRange(0, s.links.length * 2);
    /* eslint-enable react-hooks/immutability */
  });

  return (
    <lineSegments ref={lineRef} geometry={geom}>
      <lineBasicMaterial
        vertexColors
        transparent
        opacity={0.8}
        blending={THREE.AdditiveBlending}
      />
    </lineSegments>
  );
}
