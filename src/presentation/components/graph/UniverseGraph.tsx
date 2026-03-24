"use client";

import { useCallback, useRef, useMemo, useState } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  type SimulationNode,
  type SimulationLink,
  type Simulation,
} from "d3-force-3d";
import * as THREE from "three";
import { useGraphStore } from "@/store/graph-store";
import { useUIStore } from "@/store/ui-store";
import { useActivityStore } from "@/store/activity-store";
import {
  influenceToColor,
  influenceToSize,
  assignTiers,
  pulsePeriod,
  type NodeTier,
} from "@/lib/graph-utils";
import { computeClusterCentroid, type NodePosition } from "@/lib/nebula-manager";

// ── Types ──

interface GraphNodeData extends SimulationNode {
  id: string;
  name?: string;
  picture?: string;
  influenceScore: number;
  clusterId?: string;
  clusterColor?: string;
  tier: NodeTier;
}

interface GraphLinkData extends SimulationLink<GraphNodeData> {
  type: string;
  weight: number;
}

interface SimState {
  sim: Simulation<GraphNodeData>;
  nodes: GraphNodeData[];
  links: GraphLinkData[];
  nodeMap: Map<string, GraphNodeData>;
}

// ── Pure helpers ──

function buildConnectedSet(hoveredId: string): Set<string> {
  const set = new Set<string>([hoveredId]);
  for (const e of useGraphStore.getState().edges) {
    if (e.source === hoveredId) set.add(e.target);
    if (e.target === hoveredId) set.add(e.source);
  }
  return set;
}

// ── Texture cache (module-level, survives re-renders) ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const glowTextureCache = new Map<string, any>();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getGlowTexture(color: string): any {
  const cached = glowTextureCache.get(color);
  if (cached) return cached;
  const canvas = new OffscreenCanvas(128, 128);
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, color);
  g.addColorStop(0.3, color + "80");
  g.addColorStop(1, "transparent");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  glowTextureCache.set(color, tex);
  return tex;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getNebulaTexture(color: string, type: "outer" | "inner"): any {
  const key = `nebula-${type}-${color}`;
  const cached = glowTextureCache.get(key);
  if (cached) return cached;
  const size = type === "outer" ? 256 : 128;
  const half = size / 2;
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(half, half, 0, half, half, half);
  if (type === "outer") {
    g.addColorStop(0, color + "45");
    g.addColorStop(0.3, color + "25");
    g.addColorStop(0.7, color + "0c");
    g.addColorStop(1, "transparent");
  } else {
    g.addColorStop(0, color + "70");
    g.addColorStop(0.4, color + "35");
    g.addColorStop(1, "transparent");
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  glowTextureCache.set(key, tex);
  return tex;
}

// ── Avatar texture loader ──

const avatarLoader = new THREE.TextureLoader();
avatarLoader.crossOrigin = "anonymous";

// ── Node Components ──

function GlowSprite({
  color,
  size,
  nodeId,
}: {
  color: string;
  size: number;
  nodeId?: string;
}) {
  const ref = useRef<THREE.Sprite>(null);
  const tex = useMemo(() => getGlowTexture(color), [color]);
  const baseSize = size;

  // Pulse animation via useFrame (replaces onBeforeRender hack)
  useFrame(() => {
    if (!nodeId || !ref.current) return;
    const lastPost = useActivityStore.getState().lastPostTime.get(nodeId);
    if (!lastPost) return;
    const now = Date.now() / 1000;
    const period = pulsePeriod(lastPost, now);
    if (period === 0) return;
    const s = 1 + Math.sin(((now % period) / period) * Math.PI * 2) * 0.2;
    ref.current.scale.set(baseSize * s, baseSize * s, 1);
  });

  return (
    <sprite ref={ref} scale={[size, size, 1]}>
      <spriteMaterial
        map={tex}
        transparent
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </sprite>
  );
}

function AvatarSphere({
  radius,
  color,
  pictureUrl,
}: {
  radius: number;
  color: string;
  pictureUrl?: string;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const threeColor = useMemo(() => new THREE.Color(color), [color]);

  // Load avatar texture asynchronously, swap material on success
  useMemo(() => {
    if (!pictureUrl) return;
    avatarLoader.load(
      pictureUrl,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.minFilter = THREE.LinearFilter;
        tex.generateMipmaps = false;
        if (meshRef.current) {
          meshRef.current.material = new THREE.MeshBasicMaterial({ map: tex });
        }
      },
      undefined,
      () => {},
    );
  }, [pictureUrl]);

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[radius, 32, 32]} />
      <meshBasicMaterial color={threeColor} transparent opacity={0.9} />
    </mesh>
  );
}

function LabelSprite({
  text,
  size,
  alpha,
}: {
  text: string;
  size: number;
  alpha: number;
}) {
  const tex = useMemo(() => {
    const canvas = new OffscreenCanvas(256, 64);
    const ctx = canvas.getContext("2d")!;
    ctx.font = "24px monospace";
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.textAlign = "center";
    ctx.fillText(text.slice(0, 20), 128, 40);
    return new THREE.CanvasTexture(canvas);
  }, [text, alpha]);

  return (
    <sprite position={[0, size + 2, 0]} scale={[size * 2.5, size * 0.6, 1]}>
      <spriteMaterial map={tex} transparent depthWrite={false} />
    </sprite>
  );
}

function OrbitRing({ radius, color }: { radius: number; color: string }) {
  const geom = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
    }
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, [radius]);

  return (
    <primitive object={new THREE.Line(geom, new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending,
    }))} />
  );
}

function GraphNode({
  node,
  onSelect,
  onHover,
}: {
  node: GraphNodeData;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}) {
  const score = node.influenceScore;
  const color = influenceToColor(score, node.clusterColor);
  const size = influenceToSize(score);
  const tier = node.tier;

  const handleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      onSelect(node.id);
    },
    [node.id, onSelect],
  );

  const handlePointerOver = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      onHover(node.id);
    },
    [node.id, onHover],
  );

  const handlePointerOut = useCallback(() => onHover(null), [onHover]);

  return (
    <group onClick={handleClick} onPointerOver={handlePointerOver} onPointerOut={handlePointerOut}>
      {tier === "star" && (
        <>
          <AvatarSphere radius={size * 0.5} color={color} pictureUrl={node.picture} />
          <OrbitRing radius={size * 1.2} color={color} />
          <GlowSprite color={color} size={size * 3.5} nodeId={node.id} />
          {node.name && <LabelSprite text={node.name} size={size} alpha={0.8} />}
        </>
      )}
      {tier === "planet" && (
        <>
          <AvatarSphere radius={size * 0.4} color={color} pictureUrl={node.picture} />
          <GlowSprite color={color} size={size * 2.5} nodeId={node.id} />
          {node.name && <LabelSprite text={node.name} size={size} alpha={0.6} />}
        </>
      )}
      {tier === "dust" && (
        <GlowSprite
          color={color}
          size={Math.max(2, size * 0.6) * 1.5}
          nodeId={node.id}
        />
      )}
    </group>
  );
}

// ── Link rendering (single draw call for all edges) ──

function GraphLinks({ simState }: { simState: React.RefObject<SimState | null> }) {
  const lineRef = useRef<THREE.LineSegments>(null);

  useFrame(() => {
    const s = simState.current;
    if (!s || !lineRef.current) return;
    const geom = lineRef.current.geometry;
    const posAttr = geom.getAttribute("position") as THREE.BufferAttribute;
    const positions = posAttr.array as Float32Array;

    for (let i = 0; i < s.links.length; i++) {
      const link = s.links[i];
      const src = typeof link.source === "object" ? link.source : s.nodeMap.get(String(link.source));
      const tgt = typeof link.target === "object" ? link.target : s.nodeMap.get(String(link.target));
      if (src && tgt) {
        positions[i * 6] = src.x ?? 0;
        positions[i * 6 + 1] = src.y ?? 0;
        positions[i * 6 + 2] = src.z ?? 0;
        positions[i * 6 + 3] = tgt.x ?? 0;
        positions[i * 6 + 4] = tgt.y ?? 0;
        positions[i * 6 + 5] = tgt.z ?? 0;
      }
    }
    posAttr.needsUpdate = true;
  });

  const maxLinks = 2000;
  const positions = useMemo(() => new Float32Array(maxLinks * 6), []);
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return g;
  }, [positions]);

  // Update draw range when link count changes
  useMemo(() => {
    geom.setDrawRange(0, (simState.current?.links.length ?? 0) * 2);
  }, [geom, simState.current?.links.length]);

  return (
    <lineSegments ref={lineRef} geometry={geom}>
      <lineBasicMaterial color="#ffffff" transparent opacity={0.03} blending={THREE.AdditiveBlending} />
    </lineSegments>
  );
}

// ── Cluster Nebula ──

function ClusterNebula({
  color,
  memberCount,
  position,
}: {
  color: string;
  memberCount: number;
  position: [number, number, number];
}) {
  const nebulaSize = Math.min(150, 40 + memberCount * 2);
  const outerTex = useMemo(() => getNebulaTexture(color, "outer"), [color]);
  const innerTex = useMemo(() => getNebulaTexture(color, "inner"), [color]);

  return (
    <group position={position}>
      <sprite scale={[nebulaSize, nebulaSize, 1]}>
        <spriteMaterial map={outerTex} transparent blending={THREE.AdditiveBlending} depthWrite={false} />
      </sprite>
      <sprite scale={[nebulaSize * 0.4, nebulaSize * 0.4, 1]}>
        <spriteMaterial map={innerTex} transparent blending={THREE.AdditiveBlending} depthWrite={false} />
      </sprite>
    </group>
  );
}

// ── Camera monitor (replaces linkColor piggyback) ──

function CameraMonitor() {
  const lastCheckRef = useRef(0);
  const startTimeRef = useRef(Date.now());
  useFrame(({ camera }) => {
    // Skip first 3 seconds to let simulation settle
    if (Date.now() - startTimeRef.current < 3000) return;
    const now = Date.now();
    if (now - lastCheckRef.current < 300) return;
    lastCheckRef.current = now;
    const p = camera.position;
    useUIStore.getState().setCameraMoved(
      Math.abs(p.x) > 30 || Math.abs(p.y) > 30 || Math.abs(p.z - 500) > 50,
    );
  });
  return null;
}

// ── Force Graph Scene ──

function ForceGraphScene() {
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const clusters = useGraphStore((s) => s.clusters);
  const clusterStrategy = useUIStore((s) => s.clusterStrategy);
  const { camera } = useThree();

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
        tier: tierMap.get(n.id) ?? ("dust" as NodeTier),
      })),
    [nodes, tierMap, clusterColorMap],
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

  // Tick simulation + update node positions each frame
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
  });

  // Compute cluster centroids (derived, every frame via useMemo would be wrong — use useFrame)
  const [nebulaPositions, setNebulaPositions] = useState<
    Map<string, [number, number, number]>
  >(new Map());

  const lastNebulaUpdateRef = useRef(0);
  useFrame(() => {
    const now = Date.now();
    if (now - lastNebulaUpdateRef.current < 300) return;
    lastNebulaUpdateRef.current = now;
    const s = simStateRef.current;
    if (!s) return;

    const newPositions = new Map<string, [number, number, number]>();
    for (const cluster of clusters) {
      const c = computeClusterCentroid(cluster, s.nodes as NodePosition[]);
      if (c) newPositions.set(cluster.id, [c.x, c.y - 15, c.z]);
    }
    setNebulaPositions(newPositions);
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
    });

    useUIStore.getState().setFlyToClusterFn((clusterId) => {
      const s = simStateRef.current;
      if (!s) return;
      const currentClusters = useGraphStore.getState().clusters;
      const cluster = currentClusters.find((c) => c.id === clusterId);
      if (!cluster) return;
      const c = computeClusterCentroid(cluster, s.nodes as NodePosition[]);
      if (!c) return;
      camera.position.set(c.x + 150, c.y + 50, c.z + 150);
      camera.lookAt(c.x, c.y, c.z);
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
    camera.position.set(
      node.x * r,
      (node.y ?? 0) * r,
      (node.z ?? 0) * r,
    );
    camera.lookAt(node.x, node.y ?? 0, node.z ?? 0);
  }, [camera]);

  const handleNodeHover = useCallback((id: string | null) => {
    useUIStore.getState().setHoveredNode(id);
    // Dim non-connected nodes (direct response to user event)
    const connected = id ? buildConnectedSet(id) : null;
    for (const [nid, group] of nodeGroupRefs.current) {
      const highlight = !connected || connected.has(nid);
      group.traverse((child) => {
        if (!(child instanceof THREE.Mesh || child instanceof THREE.Sprite)) return;
        const mat = child.material as THREE.Material & { opacity?: number };
        if (mat.opacity === undefined) return;
        mat.userData.origOpacity ??= mat.opacity;
        mat.opacity = highlight ? (mat.userData.origOpacity as number) : 0.08;
      });
    }
  }, []);

  return (
    <>
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

      {/* Cluster nebulae */}
      {clusters.map((cluster) => {
        const pos = nebulaPositions.get(cluster.id);
        if (!pos) return null;
        return (
          <ClusterNebula
            key={cluster.id}
            color={cluster.color}
            memberCount={cluster.memberPubkeys.size}
            position={pos}
          />
        );
      })}

      {/* Camera monitor */}
      <CameraMonitor />
    </>
  );
}

// ── Main Component ──

export function UniverseGraph() {
  return (
    <div className="w-full h-full">
      <Canvas
        camera={{ position: [0, 0, 500], fov: 60 }}
        gl={{ antialias: true }}
        style={{ background: "#000008" }}
      >
        <fog attach="fog" args={[0x000008, 100, 2000]} />
        <Stars radius={1500} depth={50} count={2000} factor={4} fade speed={0.5} />
        <OrbitControls enableDamping dampingFactor={0.1} />
        <ForceGraphScene />
        <EffectComposer>
          <Bloom
            luminanceThreshold={0.9}
            luminanceSmoothing={0.025}
            intensity={0.35}
          />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
