import { useCallback, useRef, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
} from "d3-force-3d";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useGraphStore } from "@/store/graph-store";
import { useUIStore } from "@/store/ui-store";
import { useActivityStore } from "@/store/activity-store";
import {
  assignTiers,
  isNodeHighlighted,
  DEFAULT_TIER,
} from "@/lib/graph-math";
import { computeClusterCentroid } from "@/lib/nebula-manager";
import { GraphNode } from "./GraphNode";
import { GraphLinks } from "./GraphLinks";
import { EdgeParticles } from "./EdgeParticles";
import { CameraMonitor } from "./CameraMonitor";
import { buildConnectedSet, buildClusterMemberSet } from "./graph-helpers";
import type { GraphNodeData, GraphLinkData, SimState } from "./graph-types";

export function ForceGraphScene() {
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const clusters = useGraphStore((s) => s.clusters);
  const clusterStrategy = useUIStore((s) => s.clusterStrategy);
  const { camera } = useThree();

  const controlsRef = useRef<OrbitControlsImpl>(null);
  const simStateRef = useRef<SimState | null>(null);
  const nodeGroupRefs = useRef<Map<string, THREE.Group>>(new Map());
  const prevStrategyRef = useRef(clusterStrategy);

  // Derived: tier map and color map (computed during render)
  const tierMap = useMemo(() => assignTiers(nodes), [nodes]);
  const clusterColorMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of clusters) map.set(c.id, c.color);
    return map;
  }, [clusters]);

  const explorationMap = useGraphStore((s) => s.explorationMap);

  // Set of unexplored cluster IDs
  const unexploredClusterIds = useMemo(() => {
    if (!explorationMap) return new Set<string>();
    const set = new Set<string>();
    for (const [id, dist] of explorationMap.reachability) {
      if (dist === Infinity) set.add(id);
    }
    return set;
  }, [explorationMap]);

  // Build graph data for simulation
  const graphNodes: GraphNodeData[] = useMemo(
    () =>
      nodes.map((n) => ({
        id: n.id,
        name: n.name,
        picture: n.picture,
        influenceScore: n.influenceScore,
        clusterId: n.clusterId,
        clusterColor: n.clusterId ? clusterColorMap.get(n.clusterId) : undefined,
        tier: tierMap.get(n.id) ?? DEFAULT_TIER,
        isUnexplored: n.clusterId ? unexploredClusterIds.has(n.clusterId) : false,
      })),
    [nodes, tierMap, clusterColorMap, unexploredClusterIds],
  );

  const graphLinks: GraphLinkData[] = useMemo(
    () =>
      edges.map((e) => ({
        source: e.source,
        target: e.target,
        type: e.type,
        weight: e.weight,
      })),
    [edges],
  );

  // Initialize/rebuild simulation when data changes
  useMemo(() => {
    const strategyChanged = prevStrategyRef.current !== clusterStrategy;
    prevStrategyRef.current = clusterStrategy;

    // Copy nodes so d3-force can mutate them
    const simNodes = graphNodes.map((n) => {
      // Preserve positions across data updates (unless strategy changed)
      const prev = strategyChanged ? undefined : simStateRef.current?.nodeMap.get(n.id);
      return {
        ...n,
        x: prev?.x,
        y: prev?.y,
        z: prev?.z,
        vx: prev?.vx,
        vy: prev?.vy,
        vz: prev?.vz,
      };
    });

    const simLinks = graphLinks.map((l) => ({ ...l }));

    const sim = forceSimulation<GraphNodeData>(simNodes, 3)
      .force(
        "link",
        forceLink<GraphNodeData, GraphLinkData>(simLinks)
          .id((d) => d.id)
          .distance(50)
          .strength(0.3),
      )
      .force("charge", forceManyBody().strength(-40).distanceMax(300))
      .force("center", forceCenter(0, 0, 0).strength(0.05))
      .alphaDecay(0.02)
      .velocityDecay(0.4);

    const nodeMap = new Map<string, GraphNodeData>();
    for (const n of simNodes) nodeMap.set(n.id, n);

    simStateRef.current = { sim, nodes: simNodes, links: simLinks, nodeMap };
  }, [graphNodes, graphLinks, clusterStrategy]);

  // Tick simulation + update node positions + cluster dim each frame
  const prevClusterIdRef = useRef<string | null>(null);
  useFrame(() => {
    const s = simStateRef.current;
    if (!s) return;
    if (s.sim.alpha() > s.sim.alphaMin()) {
      s.sim.tick();
    }
    for (const node of s.nodes) {
      const ref = nodeGroupRefs.current.get(node.id);
      if (ref) {
        ref.position.set(node.x ?? 0, node.y ?? 0, node.z ?? 0);
      }
    }

    // Dim non-cluster nodes when a cluster is selected
    const ui = useUIStore.getState();
    const clusterId = ui.selectedClusterId;
    if (clusterId !== prevClusterIdRef.current) {
      prevClusterIdRef.current = clusterId;
      const members = clusterId ? buildClusterMemberSet(clusterId) : null;
      for (const [nid, group] of nodeGroupRefs.current) {
        const highlight = isNodeHighlighted(nid, members);
        group.traverse((child) => {
          if (!(child instanceof THREE.Mesh || child instanceof THREE.Sprite)) return;
          const mat = child.material;
          if (!("opacity" in mat) || typeof mat.opacity !== "number") return;
          mat.userData.origOpacity ??= mat.opacity;
          const orig = mat.userData.origOpacity;
          mat.opacity = highlight ? (typeof orig === "number" ? orig : 1) : 0.06;
        });
      }
    }

    // Clear expired flash entries
    useActivityStore.getState().clearExpiredFlashes(Date.now());
  });

  // Register UI callbacks — done in useFrame's first tick (not during render)
  // to avoid "setState during render" error. The callbacks read from refs
  // so they always access current state.
  const callbacksRegistered = useRef(false);
  useFrame(() => {
    if (callbacksRegistered.current) return;
    callbacksRegistered.current = true;

    useUIStore.getState().setReheatSimulationFn(() => {
      simStateRef.current?.sim.alpha(1).restart();
    });

    useUIStore.getState().setResetCameraFn(() => {
      camera.position.set(0, 0, 500);
      camera.lookAt(0, 0, 0);
      if (controlsRef.current) {
        controlsRef.current.target.set(0, 0, 0);
        controlsRef.current.update();
      }
    });

    useUIStore.getState().setFlyToClusterFn((clusterId) => {
      const s = simStateRef.current;
      if (!s) return;
      const currentClusters = useGraphStore.getState().clusters;
      const cluster = currentClusters.find((c) => c.id === clusterId);
      if (!cluster) return;
      const c = computeClusterCentroid(cluster, s.nodes);
      if (!c) return;
      camera.position.set(c.x + 150, c.y + 50, c.z + 150);
      camera.lookAt(c.x, c.y, c.z);
      if (controlsRef.current) {
        controlsRef.current.target.set(c.x, c.y, c.z);
        controlsRef.current.update();
      }
    });
  });

  // Event handlers
  const handleNodeSelect = useCallback((id: string) => {
    useUIStore.getState().selectNode(id);
    const s = simStateRef.current;
    if (!s) return;
    const node = s.nodeMap.get(id);
    if (!node || node.x === undefined) return;
    const d = 100;
    const r = 1 + d / Math.hypot(node.x, node.y ?? 0, node.z ?? 1);
    const tx = node.x, ty = node.y ?? 0, tz = node.z ?? 0;
    camera.position.set(tx * r, ty * r, tz * r);
    camera.lookAt(tx, ty, tz);
    if (controlsRef.current) {
      controlsRef.current.target.set(tx, ty, tz);
      controlsRef.current.update();
    }
  }, [camera]);

  const handleNodeHover = useCallback((id: string | null) => {
    useUIStore.getState().setHoveredNode(id);
    // Dim non-connected nodes (direct response to user event)
    const connected = id ? buildConnectedSet(id) : null;
    for (const [nid, group] of nodeGroupRefs.current) {
      const highlight = !connected || connected.has(nid);
      group.traverse((child) => {
        if (!(child instanceof THREE.Mesh || child instanceof THREE.Sprite)) return;
        const mat = child.material;
        if (!("opacity" in mat) || typeof mat.opacity !== "number") return;
        mat.userData.origOpacity ??= mat.opacity;
        const orig = mat.userData.origOpacity;
        mat.opacity = highlight ? (typeof orig === "number" ? orig : 1) : 0.08;
      });
    }
  }, []);

  return (
    <>
      <OrbitControls ref={controlsRef} enableDamping dampingFactor={0.1} />

      {/* Nodes */}
      {graphNodes.map((node) => (
        <group
          key={node.id}
          ref={(el) => {
            if (el) nodeGroupRefs.current.set(node.id, el);
          }}
        >
          <GraphNode
            node={node}
            onSelect={handleNodeSelect}
            onHover={handleNodeHover}
          />
        </group>
      ))}

      {/* Links */}
      <GraphLinks simState={simStateRef} />

      {/* Particle flow on active edges */}
      <EdgeParticles simState={simStateRef} />

      {/* Camera monitor */}
      <CameraMonitor />
    </>
  );
}
