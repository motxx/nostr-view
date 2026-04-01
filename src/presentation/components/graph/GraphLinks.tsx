import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useGraphStore } from "@/store/graph-store";
import { useUIStore } from "@/store/ui-store";
import { isEdgeActive, type EdgeActiveContext } from "@/lib/graph-math";
import { buildConnectedSet, buildClusterMemberSet } from "./graph-helpers";
import type { SimState } from "./graph-types";

export function GraphLinks({ simState }: { simState: React.RefObject<SimState | null> }) {
  const lineRef = useRef<THREE.LineSegments>(null);

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

    // Determine which node/cluster is active
    const ui = useUIStore.getState();
    const activeId = ui.selectedNodeId ?? ui.hoveredNodeId;
    const connected = activeId ? buildConnectedSet(activeId) : null;
    const selectedClusterId = ui.selectedClusterId;
    const clusterMembers = (!activeId && selectedClusterId)
      ? buildClusterMemberSet(selectedClusterId)
      : null;
    const clusterColor = clusterMembers && selectedClusterId
      ? new THREE.Color(
          useGraphStore.getState().clusters.find((c) => c.id === selectedClusterId)?.color ?? "#00ff41",
        )
      : null;
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
