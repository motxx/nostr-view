"use client";

import {
  Component,
  useCallback,
  useRef,
  useMemo,
  useState,
  type ReactNode,
  type ErrorInfo,
} from "react";
import type {
  ForceGraphMethods,
  NodeObject,
  LinkObject,
} from "react-force-graph-3d";
// Direct import — safe because this module is loaded client-side only
// via next/dynamic({ ssr: false }) in page.tsx
import ForceGraph3D from "react-force-graph-3d";
import { useGraphStore } from "@/store/graph-store";
import { useUIStore } from "@/store/ui-store";
import { useActivityStore } from "@/store/activity-store";
import {
  influenceToColor,
  createStarField,
  createStarNode,
  createPlanetNode,
  createDustNode,
  assignTiers,
  pulsePeriod,
  type NodeTier,
} from "@/lib/graph-utils";
import * as THREE from "three";

// ── Error boundary (catches WebGL failures — no manual check needed) ──

class WebGLErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn("WebGL/3D rendering failed:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-[#000008] gap-4">
          <div className="font-mono text-lg text-white/60">
            WebGL is not available
          </div>
          <div className="font-mono text-sm text-white/30 max-w-md text-center">
            3D rendering requires WebGL support. Please use a browser with
            hardware acceleration enabled.
          </div>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="font-mono text-sm text-blue-400 hover:text-blue-300 border border-blue-400/30 rounded px-4 py-2"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Types ──

interface NodeExtra {
  name?: string;
  picture?: string;
  influenceScore: number;
  clusterId?: string;
  clusterColor?: string;
  tier: NodeTier;
}

interface LinkExtra {
  type: string;
  weight: number;
}

type GNode = NodeObject<NodeExtra>;
type GLink = LinkObject<NodeExtra, LinkExtra>;
type GraphMethods = ForceGraphMethods<NodeExtra, LinkExtra>;

// ── Helpers (pure functions, no hooks) ──

const OVERVIEW_DISTANCE = 450;

function resolveNodeId(
  nodeOrId: string | number | GNode | undefined,
): string | undefined {
  if (!nodeOrId) return undefined;
  if (typeof nodeOrId === "object") return nodeOrId.id as string;
  return String(nodeOrId);
}

/** Apply opacity dimming to all tracked node objects. */
function applyDimming(
  hoveredId: string | null,
  nodeObjects: Map<string, THREE.Group>,
) {
  const connected = new Set<string>();
  if (hoveredId) {
    connected.add(hoveredId);
    for (const e of useGraphStore.getState().edges) {
      if (e.source === hoveredId) connected.add(e.target);
      if (e.target === hoveredId) connected.add(e.source);
    }
  }

  for (const [id, group] of nodeObjects) {
    const isHighlighted = !hoveredId || connected.has(id);
    group.traverse((child) => {
      if (!(child instanceof THREE.Mesh || child instanceof THREE.Sprite))
        return;
      const mat = child.material as THREE.Material & { opacity?: number };
      if (mat.opacity === undefined) return;
      if (mat.userData.origOpacity === undefined) {
        mat.userData.origOpacity = mat.opacity;
      }
      mat.opacity = isHighlighted
        ? (mat.userData.origOpacity as number)
        : 0.08;
    });
  }
}

// ── Component — zero useEffect, zero DOM manipulation ──

function UniverseGraphInner() {
  const graphRef = useRef<GraphMethods | undefined>(undefined);
  const starFieldRef = useRef<THREE.Points | null>(null);
  const initializedRef = useRef(false);
  const nodeObjectsRef = useRef<Map<string, THREE.Group>>(new Map());
  const [isHovering, setIsHovering] = useState(false);

  // Only subscribe to data that drives rendering.
  // UI state (hoveredNodeId, etc.) is read via getState() in callbacks
  // so hovering doesn't cause React re-renders.
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const clusters = useGraphStore((s) => s.clusters);

  // ── Derived data (computed during render) ──

  const clusterColorMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of clusters) map.set(c.id, c.color);
    return map;
  }, [clusters]);

  const tierMap = useMemo(() => assignTiers(nodes), [nodes]);

  const prevNodesRef = useRef<Map<string, GNode>>(new Map());

  const graphData = useMemo(() => {
    const prevMap = prevNodesRef.current;
    const graphNodes: GNode[] = nodes.map((n) => {
      const prev = prevMap.get(n.id);
      const tier = tierMap.get(n.id) ?? "dust";
      const node: GNode = {
        id: n.id,
        name: n.name,
        picture: n.picture,
        influenceScore: n.influenceScore,
        clusterId: n.clusterId,
        clusterColor: n.clusterId
          ? clusterColorMap.get(n.clusterId)
          : undefined,
        tier,
      };
      if (prev) {
        node.x = prev.x;
        node.y = prev.y;
        node.z = prev.z;
        node.vx = prev.vx;
        node.vy = prev.vy;
        node.vz = prev.vz;
      }
      return node;
    });

    const newMap = new Map<string, GNode>();
    for (const n of graphNodes) newMap.set(n.id as string, n);
    prevNodesRef.current = newMap;

    const graphEdges: GLink[] = edges.map((e) => ({
      source: e.source,
      target: e.target,
      type: e.type,
      weight: e.weight,
    }));

    return { nodes: graphNodes, links: graphEdges };
  }, [nodes, edges, clusterColorMap, tierMap]);

  // ── Event handlers (user actions — not effects) ──

  const handleEngineReady = useCallback(() => {
    const fg = graphRef.current;
    if (!fg) return;

    const scene = fg.scene();
    if (scene && !starFieldRef.current) {
      const stars = createStarField(2000, 3000);
      starFieldRef.current = stars;
      scene.add(stars);
      scene.fog = new THREE.FogExp2(0x000008, 0.00015);
    }

    const renderer = fg.renderer();
    if (renderer) renderer.setClearColor(0x000008, 1);

    if (!initializedRef.current) {
      initializedRef.current = true;
      fg.cameraPosition({ x: 0, y: 0, z: 500 });
    }

    // Register reset callback — direct call in event handler, no effect
    useUIStore.getState().setResetCameraFn(() => {
      fg.cameraPosition(
        { x: 0, y: 0, z: 500 },
        { x: 0, y: 0, z: 0 },
        1500,
      );
    });
  }, []);

  // Pulse animation is driven by Three.js's own render loop via onBeforeRender
  // on each glow sprite. No separate rAF / useEffect needed.
  const nodeThreeObject = useCallback((node: GNode) => {
    const score = node.influenceScore ?? 0;
    const color = influenceToColor(score, node.clusterColor);
    const tier = node.tier ?? "dust";

    let group: THREE.Group;
    switch (tier) {
      case "star":
        group = createStarNode(score, color, node.name, node.picture);
        break;
      case "planet":
        group = createPlanetNode(score, color, node.name, node.picture);
        break;
      default:
        group = createDustNode(score, color);
        break;
    }

    // Attach pulse animation to glow sprite's onBeforeRender.
    // Three.js calls this automatically each frame — no useEffect / rAF needed.
    const glow = group.getObjectByName("glow") as THREE.Sprite | null;
    if (glow) {
      const baseScale = glow.scale.x;
      const nodeId = node.id as string;
      glow.onBeforeRender = () => {
        const lastPost =
          useActivityStore.getState().lastPostTime.get(nodeId);
        if (!lastPost) return;
        const nowSec = Date.now() / 1000;
        const period = pulsePeriod(lastPost, nowSec);
        if (period === 0) return;
        const phase = ((nowSec % period) / period) * Math.PI * 2;
        const scale = 1 + Math.sin(phase) * 0.2;
        glow.scale.set(baseScale * scale, baseScale * scale, 1);
      };
    }

    nodeObjectsRef.current.set(node.id as string, group);
    return group;
  }, []);

  const handleNodeClick = useCallback((node: GNode) => {
    useUIStore.getState().selectNode(node.id as string);

    const fg = graphRef.current;
    if (
      fg &&
      node.x !== undefined &&
      node.y !== undefined &&
      node.z !== undefined
    ) {
      const distance = 100;
      const distRatio =
        1 + distance / Math.hypot(node.x, node.y, node.z || 1);
      fg.cameraPosition(
        {
          x: node.x * distRatio,
          y: node.y * distRatio,
          z: (node.z || 0) * distRatio,
        },
        { x: node.x, y: node.y, z: node.z || 0 },
        1500,
      );
    }
  }, []);

  // Dimming is a direct response to the hover event, not a reactive effect.
  // Cursor is managed via React state (declarative), not DOM manipulation.
  const handleNodeHover = useCallback(
    (node: GNode | null) => {
      const id = node ? (node.id as string) : null;
      useUIStore.getState().setHoveredNode(id);
      applyDimming(id, nodeObjectsRef.current);
      setIsHovering(!!node);
    },
    [setIsHovering],
  );

  // ── Link callbacks: stable references, read hovered state from store ──
  // Camera distance check piggybacks on linkColor (called by react-force-graph
  // each frame for each link), eliminating the need for a separate rAF loop.

  const lastCameraCheckRef = useRef(0);

  const linkColor = useCallback((edge: GLink) => {
    // Camera distance check — throttled, piggybacks on the graph's render loop
    const now = Date.now();
    if (now - lastCameraCheckRef.current > 200) {
      lastCameraCheckRef.current = now;
      const fg = graphRef.current;
      if (fg) {
        const camera = fg.camera();
        if (camera) {
          useUIStore
            .getState()
            .setZoomedIn(camera.position.length() < OVERVIEW_DISTANCE);
        }
      }
    }

    const hovered = useUIStore.getState().hoveredNodeId;
    const src = resolveNodeId(edge.source);
    const tgt = resolveNodeId(edge.target);

    if (hovered && (src === hovered || tgt === hovered)) {
      switch (edge.type) {
        case "follow":
          return "rgba(100, 180, 255, 0.8)";
        case "reaction":
          return "rgba(255, 220, 100, 0.8)";
        case "repost":
          return "rgba(100, 255, 180, 0.8)";
        case "reply":
          return "rgba(200, 130, 255, 0.8)";
        default:
          return "rgba(255, 255, 255, 0.6)";
      }
    }

    if (hovered) return "rgba(255, 255, 255, 0.02)";

    switch (edge.type) {
      case "follow":
        return "rgba(100, 150, 255, 0.15)";
      case "reaction":
        return "rgba(255, 200, 100, 0.2)";
      case "repost":
        return "rgba(100, 255, 150, 0.25)";
      case "reply":
        return "rgba(200, 100, 255, 0.2)";
      default:
        return "rgba(255, 255, 255, 0.1)";
    }
  }, []);

  const linkDirectionalParticles = useCallback((edge: GLink) => {
    const hovered = useUIStore.getState().hoveredNodeId;
    if (!hovered) return 0;
    const src = resolveNodeId(edge.source);
    const tgt = resolveNodeId(edge.target);
    return src === hovered || tgt === hovered ? 4 : 0;
  }, []);

  const linkDirectionalParticleWidth = useCallback((edge: GLink) => {
    const hovered = useUIStore.getState().hoveredNodeId;
    if (!hovered) return 0;
    const src = resolveNodeId(edge.source);
    const tgt = resolveNodeId(edge.target);
    return src === hovered || tgt === hovered ? (edge.weight ?? 1) * 1.5 : 0;
  }, []);

  // ── Render (declarative — cursor via className, not DOM manipulation) ──

  return (
    <div className={`w-full h-full ${isHovering ? "cursor-pointer" : ""}`}>
      <ForceGraph3D
        ref={graphRef}
        graphData={graphData}
        nodeThreeObject={nodeThreeObject}
        nodeThreeObjectExtend={false}
        linkColor={linkColor}
        linkWidth={(edge: GLink) => (edge.weight ?? 1) * 0.3}
        linkOpacity={0.3}
        linkDirectionalParticles={linkDirectionalParticles}
        linkDirectionalParticleWidth={linkDirectionalParticleWidth}
        linkDirectionalParticleSpeed={0.006}
        onNodeClick={handleNodeClick}
        onNodeHover={handleNodeHover}
        onEngineStop={handleEngineReady}
        backgroundColor="#000008"
        showNavInfo={false}
        enableNodeDrag={true}
        d3AlphaDecay={0.05}
        d3VelocityDecay={0.4}
        warmupTicks={100}
        cooldownTicks={50}
        cooldownTime={5000}
      />
    </div>
  );
}

export function UniverseGraph() {
  return (
    <WebGLErrorBoundary>
      <UniverseGraphInner />
    </WebGLErrorBoundary>
  );
}
