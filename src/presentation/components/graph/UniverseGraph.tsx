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
import { NebulaManager } from "@/lib/nebula-manager";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

// ── Error boundary ──

class WebGLErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
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
          <button
            onClick={() => this.setState({ hasError: false })}
            className="font-mono text-sm text-blue-400 border border-blue-400/30 rounded px-4 py-2"
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

// ── Pure helpers ──

function resolveNodeId(
  v: string | number | GNode | undefined,
): string | undefined {
  if (!v) return undefined;
  return typeof v === "object" ? (v.id as string) : String(v);
}

function buildConnectedSet(hoveredId: string): Set<string> {
  const set = new Set<string>([hoveredId]);
  for (const e of useGraphStore.getState().edges) {
    if (e.source === hoveredId) set.add(e.target);
    if (e.target === hoveredId) set.add(e.source);
  }
  return set;
}

function applyDimming(
  hoveredId: string | null,
  nodeObjects: Map<string, THREE.Group>,
) {
  const connected = hoveredId ? buildConnectedSet(hoveredId) : null;
  for (const [id, group] of nodeObjects) {
    const highlight = !connected || connected.has(id);
    group.traverse((child) => {
      if (!(child instanceof THREE.Mesh || child instanceof THREE.Sprite))
        return;
      const mat = child.material as THREE.Material & { opacity?: number };
      if (mat.opacity === undefined) return;
      mat.userData.origOpacity ??= mat.opacity;
      mat.opacity = highlight ? (mat.userData.origOpacity as number) : 0.08;
    });
  }
}

// ── Scene setup (called once) ──

function setupBloom(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
) {
  const size = renderer.getSize(new THREE.Vector2());
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(size, 0.35, 0.25, 0.92));

  const origRender = renderer.render.bind(renderer);
  let inComposer = false;
  renderer.render = (s: THREE.Scene, c: THREE.Camera) => {
    if (inComposer) {
      origRender(s, c);
      return;
    }
    inComposer = true;
    composer.render();
    inComposer = false;
  };
  return composer;
}

// ── Link color — pure function, no side effects ──

const HOVER_COLORS: Record<string, string> = {
  follow: "rgba(100,180,255,0.8)",
  reaction: "rgba(255,220,100,0.8)",
  repost: "rgba(100,255,180,0.8)",
  reply: "rgba(200,130,255,0.8)",
};

const BASE_COLORS: Record<string, string> = {
  follow: "rgba(100,150,255,0.12)",
  reaction: "rgba(255,200,100,0.15)",
  repost: "rgba(100,255,150,0.18)",
  reply: "rgba(200,100,255,0.15)",
};

function computeLinkColor(edge: GLink): string {
  const hovered = useUIStore.getState().hoveredNodeId;
  const src = resolveNodeId(edge.source);
  const tgt = resolveNodeId(edge.target);

  // Hover highlight
  if (hovered && (src === hovered || tgt === hovered)) {
    return HOVER_COLORS[edge.type] ?? "rgba(255,255,255,0.6)";
  }
  if (hovered) return "rgba(255,255,255,0.02)";

  // Cluster tint
  const sn = typeof edge.source === "object" ? (edge.source as GNode) : null;
  const tn = typeof edge.target === "object" ? (edge.target as GNode) : null;
  if (
    sn?.clusterColor &&
    tn?.clusterColor &&
    sn.clusterId === tn.clusterId
  ) {
    return sn.clusterColor + "25";
  }

  return BASE_COLORS[edge.type] ?? "rgba(255,255,255,0.08)";
}

// ── Component ──

function UniverseGraphInner() {
  const graphRef = useRef<GraphMethods | undefined>(undefined);
  const composerRef = useRef<EffectComposer | null>(null);
  const starFieldRef = useRef<THREE.Points | null>(null);
  const nebulaManagerRef = useRef(new NebulaManager());
  const initializedRef = useRef(false);
  const nodeObjectsRef = useRef<Map<string, THREE.Group>>(new Map());
  const prevNodesRef = useRef<Map<string, GNode>>(new Map());
  const prevStrategyRef = useRef<string>("");
  const lastFrameCheckRef = useRef(0);
  const [isHovering, setIsHovering] = useState(false);

  // Reactive subscriptions — only what drives rendering
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const clusters = useGraphStore((s) => s.clusters);
  const clusterStrategy = useUIStore((s) => s.clusterStrategy);

  // ── Derived data (computed during render, no side effects) ──

  const clusterColorMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of clusters) map.set(c.id, c.color);
    return map;
  }, [clusters]);

  const tierMap = useMemo(() => assignTiers(nodes), [nodes]);

  const graphData = useMemo(() => {
    // When strategy changes, discard stale positions so the simulation
    // lays out nodes fresh for the new clustering.
    if (prevStrategyRef.current !== clusterStrategy) {
      prevNodesRef.current = new Map();
      prevStrategyRef.current = clusterStrategy;
    }

    const prevMap = prevNodesRef.current;
    const graphNodes: GNode[] = nodes.map((n) => {
      const prev = prevMap.get(n.id);
      const node: GNode = {
        id: n.id,
        name: n.name,
        picture: n.picture,
        influenceScore: n.influenceScore,
        clusterId: n.clusterId,
        clusterColor: n.clusterId
          ? clusterColorMap.get(n.clusterId)
          : undefined,
        tier: tierMap.get(n.id) ?? "dust",
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

    return {
      nodes: graphNodes,
      links: edges.map((e) => ({
        source: e.source,
        target: e.target,
        type: e.type,
        weight: e.weight,
      })),
    };
  }, [nodes, edges, clusterColorMap, tierMap, clusterStrategy]);

  // ── Event: engine initialization (called from onEngineStop) ──

  const handleEngineStop = useCallback(() => {
    const fg = graphRef.current;
    if (!fg) return;
    const scene = fg.scene();
    const renderer = fg.renderer() as THREE.WebGLRenderer;

    // ── One-time setup ──
    if (!initializedRef.current) {
      initializedRef.current = true;

      // Starfield + fog
      if (scene) {
        starFieldRef.current = createStarField(2000, 3000);
        scene.add(starFieldRef.current);
        scene.fog = new THREE.FogExp2(0x000008, 0.00015);
      }

      if (renderer) renderer.setClearColor(0x000008, 1);

      // Bloom post-processing
      if (renderer && scene) {
        composerRef.current = setupBloom(renderer, scene, fg.camera());
      }

      // Camera
      fg.cameraPosition({ x: 0, y: 0, z: 500 });

      // Per-frame work via scene.onBeforeRender (Three.js render loop).
      // Handles: camera monitoring + nebula position sync.
      // No useEffect, no addEventListener — just a Three.js callback.
      if (scene) {
        scene.onBeforeRender = () => {
          const now = Date.now();
          if (now - lastFrameCheckRef.current < 200) return;
          lastFrameCheckRef.current = now;

          // Camera check
          const cam = fg.camera();
          if (cam) {
            const p = cam.position;
            useUIStore.getState().setCameraMoved(
              Math.abs(p.x) > 30 ||
                Math.abs(p.y) > 30 ||
                Math.abs(p.z - 500) > 50,
            );
          }

          // Nebula sync
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const liveNodes = ((fg as any).graphData?.()?.nodes ?? []) as GNode[];
          const currentClusters = useGraphStore.getState().clusters;
          nebulaManagerRef.current.sync(scene, currentClusters, liveNodes);
        };
      }

      // Register UI callbacks
      useUIStore.getState().setResetCameraFn(() => {
        fg.cameraPosition(
          { x: 0, y: 0, z: 500 },
          { x: 0, y: 0, z: 0 },
          1500,
        );
      });

      useUIStore.getState().setFlyToClusterFn((clusterId) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const liveNodes = ((fg as any).graphData?.()?.nodes ?? []) as GNode[];
        const currentClusters = useGraphStore.getState().clusters;
        const c = nebulaManagerRef.current.getCentroid(
          clusterId,
          currentClusters,
          liveNodes,
        );
        if (!c) return;
        fg.cameraPosition(
          { x: c.x + 150, y: c.y + 50, z: c.z + 150 },
          c,
          1500,
        );
      });

      useUIStore.getState().setReheatSimulationFn(() => {
        fg.d3ReheatSimulation();
      });
    }
  }, []);

  // ── Event: node three.js object creation ──

  const nodeThreeObject = useCallback((node: GNode) => {
    const score = node.influenceScore ?? 0;
    const color = influenceToColor(score, node.clusterColor);
    let group: THREE.Group;
    switch (node.tier ?? "dust") {
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

    // Pulse glow via Three.js render loop
    const glow = group.getObjectByName("glow") as THREE.Sprite | null;
    if (glow) {
      const base = glow.scale.x;
      const id = node.id as string;
      glow.onBeforeRender = () => {
        const lastPost = useActivityStore.getState().lastPostTime.get(id);
        if (!lastPost) return;
        const now = Date.now() / 1000;
        const period = pulsePeriod(lastPost, now);
        if (period === 0) return;
        const s =
          1 + Math.sin(((now % period) / period) * Math.PI * 2) * 0.2;
        glow.scale.set(base * s, base * s, 1);
      };
    }

    nodeObjectsRef.current.set(node.id as string, group);
    return group;
  }, []);

  // ── Event: node click ──

  const handleNodeClick = useCallback((node: GNode) => {
    useUIStore.getState().selectNode(node.id as string);
    const fg = graphRef.current;
    if (
      fg &&
      node.x !== undefined &&
      node.y !== undefined &&
      node.z !== undefined
    ) {
      const d = 100;
      const r = 1 + d / Math.hypot(node.x, node.y, node.z || 1);
      fg.cameraPosition(
        { x: node.x * r, y: node.y * r, z: (node.z || 0) * r },
        { x: node.x, y: node.y, z: node.z || 0 },
        1500,
      );
    }
  }, []);

  // ── Event: node hover → dimming (direct response, not an effect) ──

  const handleNodeHover = useCallback((node: GNode | null) => {
    useUIStore.getState().setHoveredNode(node ? (node.id as string) : null);
    applyDimming(node ? (node.id as string) : null, nodeObjectsRef.current);
    setIsHovering(!!node);
  }, []);

  // ── Link callbacks (stable, pure, read from store) ──

  const linkColor = useCallback(computeLinkColor, []);

  const linkParticles = useCallback((edge: GLink) => {
    const h = useUIStore.getState().hoveredNodeId;
    if (!h) return 0;
    const s = resolveNodeId(edge.source);
    const t = resolveNodeId(edge.target);
    return s === h || t === h ? 4 : 0;
  }, []);

  const linkParticleWidth = useCallback((edge: GLink) => {
    const h = useUIStore.getState().hoveredNodeId;
    if (!h) return 0;
    const s = resolveNodeId(edge.source);
    const t = resolveNodeId(edge.target);
    return s === h || t === h ? (edge.weight ?? 1) * 1.5 : 0;
  }, []);

  // ── Render ──

  return (
    <div
      className={`relative w-full h-full z-0 ${isHovering ? "cursor-pointer" : ""}`}
    >
      <ForceGraph3D
        ref={graphRef}
        graphData={graphData}
        nodeThreeObject={nodeThreeObject}
        nodeThreeObjectExtend={false}
        linkColor={linkColor}
        linkWidth={(e: GLink) => (e.weight ?? 1) * 0.3}
        linkOpacity={0.3}
        linkDirectionalParticles={linkParticles}
        linkDirectionalParticleWidth={linkParticleWidth}
        linkDirectionalParticleSpeed={0.006}
        onNodeClick={handleNodeClick}
        onNodeHover={handleNodeHover}
        onEngineStop={handleEngineStop}
        backgroundColor="#000008"
        showNavInfo={false}
        enableNodeDrag={true}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.4}
        warmupTicks={100}
        cooldownTicks={200}
        cooldownTime={15000}
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
