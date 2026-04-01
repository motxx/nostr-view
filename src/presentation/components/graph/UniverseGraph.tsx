"use client";

import { useCallback, useRef, useMemo, useEffect } from "react";
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
  tierBrightness,
  DEFAULT_TIER,
  type NodeTier,
} from "@/lib/graph-utils";
import { flashBoost } from "@/lib/flash-decay";
import { computeClusterCentroid } from "@/lib/nebula-manager";
import {
  spawnParticles,
  advanceParticles,
  lerp,
  type Particle,
  type EdgeEndpoints,
} from "@/lib/edge-particles";

// ── Types ──

interface GraphNodeData extends SimulationNode {
  id: string;
  name?: string;
  picture?: string;
  influenceScore: number;
  clusterId?: string;
  clusterColor?: string;
  tier: NodeTier;
  isUnexplored?: boolean;
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
const signalTextureCache = new Map<string, any>();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSignalTexture(color: string): any {
  const cached = signalTextureCache.get(color);
  if (cached) return cached;
  const canvas = new OffscreenCanvas(128, 128);
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  // Sharp signal point: bright core, fast falloff
  g.addColorStop(0, color);
  g.addColorStop(0.15, color);
  g.addColorStop(0.5, color + "1a"); // ~10% alpha
  g.addColorStop(1, "transparent");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  signalTextureCache.set(color, tex);
  return tex;
}

// ── Avatar texture loader ──

const avatarLoader = new THREE.TextureLoader();
avatarLoader.crossOrigin = "anonymous";

// ── Node Components ──

function SignalSprite({
  color,
  size,
  nodeId,
}: {
  color: string;
  size: number;
  nodeId?: string;
}) {
  const ref = useRef<THREE.Sprite>(null);
  const tex = useMemo(() => getSignalTexture(color), [color]);
  const baseSize = size;

  // Pulse animation via useFrame (replaces onBeforeRender hack)
  useFrame(() => {
    if (!nodeId || !ref.current) return;
    const activityState = useActivityStore.getState();

    // Flash boost: bright burst on new event arrival
    const flashTs = activityState.flashTimestamps.get(nodeId);
    const flash = flashTs ? flashBoost(Date.now() - flashTs, 1000) : 1;

    const lastPost = activityState.lastPostTime.get(nodeId);
    if (!lastPost) {
      if (flash > 1) ref.current.scale.set(baseSize * flash, baseSize * flash, 1);
      return;
    }
    const now = Date.now() / 1000;
    const period = pulsePeriod(lastPost, now);
    if (period === 0) {
      if (flash > 1) ref.current.scale.set(baseSize * flash, baseSize * flash, 1);
      return;
    }
    const s = 1 + Math.sin(((now % period) / period) * Math.PI * 2) * 0.2;
    ref.current.scale.set(baseSize * s * flash, baseSize * s * flash, 1);
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
  // Brighter emissive for fallback so avatar sphere is visible without lighting
  const emissiveColor = useMemo(
    () => new THREE.Color(color).multiplyScalar(0.4),
    [color],
  );

  // Load avatar texture asynchronously, swap material on success
  useEffect(() => {
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
      <meshStandardMaterial
        color={threeColor}
        emissive={emissiveColor}
        emissiveIntensity={1.5}
        transparent
        opacity={0.95}
        roughness={0.3}
        metalness={0.1}
      />
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
    ctx.fillStyle = `rgba(0,255,65,${alpha})`;
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

function RadarPulse({
  radius,
  color,
  nodeId,
}: {
  radius: number;
  color: string;
  nodeId?: string;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const ringCount = 3;

  const rings = useMemo(() => {
    const arr: THREE.Line[] = [];
    for (let r = 0; r < ringCount; r++) {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 64; i++) {
        const a = (i / 64) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a), 0, Math.sin(a)));
      }
      const geom = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
      });
      const line = new THREE.Line(geom, mat);
      line.userData.phaseOffset = r / ringCount;
      arr.push(line);
    }
    return arr;
  }, [color, ringCount]);

  useFrame(() => {
    if (!groupRef.current) return;

    // Three.js objects returned from useMemo are our own mutable scene objects.
    // Mutating scale/material per frame is the standard R3F pattern.
    /* eslint-disable react-hooks/immutability -- Three.js object mutation in useFrame */

    // Determine pulse speed from activity
    let period = 3; // default moderate speed
    if (nodeId) {
      const lastPost = useActivityStore.getState().lastPostTime.get(nodeId);
      if (lastPost) {
        const p = pulsePeriod(lastPost, Date.now() / 1000);
        if (p > 0) period = p;
      }
    }

    const now = Date.now() / 1000;
    for (const ring of rings) {
      const phase = ring.userData.phaseOffset as number;
      const t = ((now / period + phase) % 1);
      const scale = t * radius;
      ring.scale.set(scale, scale, scale);
      const mat = ring.material as THREE.LineBasicMaterial;
      mat.opacity = (1 - t) * 0.4;
    }
    /* eslint-enable react-hooks/immutability */
  });

  return (
    <group ref={groupRef}>
      {rings.map((ring, i) => (
        <primitive key={i} object={ring} />
      ))}
    </group>
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
  const rawColor = influenceToColor(score, node.clusterColor);
  const tier = node.tier;
  // Tier-based brightness — hubs brighter, edges darker
  const color = tierBrightness(rawColor, tier);
  const size = influenceToSize(score);
  const dimFactor = node.isUnexplored ? 0.3 : 1;

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
      {tier === "hub" && (
        <>
          <AvatarSphere radius={size * 0.5} color={color} pictureUrl={node.picture} />
          <RadarPulse radius={size * 1.2} color={color} nodeId={node.id} />
          <SignalSprite color={color} size={size * 3.5 * dimFactor} nodeId={node.id} />
          {node.name && <LabelSprite text={node.name} size={size} alpha={0.8 * dimFactor} />}
        </>
      )}
      {tier === "node" && (
        <>
          <AvatarSphere radius={size * 0.4} color={color} pictureUrl={node.picture} />
          <SignalSprite color={color} size={size * 2.5 * dimFactor} nodeId={node.id} />
          {node.name && <LabelSprite text={node.name} size={size} alpha={0.6 * dimFactor} />}
        </>
      )}
      {tier === "edge" && (
        <>
          {node.picture && (
            <AvatarSphere radius={Math.max(1.2, size * 0.25)} color={color} pictureUrl={node.picture} />
          )}
          <SignalSprite
            color={color}
            size={Math.max(2.5, size * 0.8) * 1.5 * dimFactor}
            nodeId={node.id}
          />
          {node.name && (
            <LabelSprite text={node.name} size={Math.max(2, size * 0.6)} alpha={0.35 * dimFactor} />
          )}
        </>
      )}
    </group>
  );
}

// ── Link rendering ──
// Edges are invisible by default. When a node is selected or hovered,
// only its connected edges light up. Uses per-vertex color to control
// visibility in a single draw call.

function GraphLinks({ simState }: { simState: React.RefObject<SimState | null> }) {
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

    // Determine which node is active (selected or hovered)
    const ui = useUIStore.getState();
    const activeId = ui.selectedNodeId ?? ui.hoveredNodeId;
    const connected = activeId ? buildConnectedSet(activeId) : null;

    for (let i = 0; i < s.links.length; i++) {
      const link = s.links[i];
      const src = typeof link.source === "object" ? link.source : s.nodeMap.get(String(link.source));
      const tgt = typeof link.target === "object" ? link.target : s.nodeMap.get(String(link.target));
      if (!src || !tgt) continue;

      const srcId = String(src.id);
      const tgtId = String(tgt.id);
      const isActive =
        connected &&
        (srcId === activeId || tgtId === activeId) &&
        connected.has(srcId) &&
        connected.has(tgtId);

      if (isActive) {
        // Show: real positions + bright color
        pos[i * 6] = src.x ?? 0;
        pos[i * 6 + 1] = src.y ?? 0;
        pos[i * 6 + 2] = src.z ?? 0;
        pos[i * 6 + 3] = tgt.x ?? 0;
        pos[i * 6 + 4] = tgt.y ?? 0;
        pos[i * 6 + 5] = tgt.z ?? 0;
        col[i * 6] = 0.0; col[i * 6 + 1] = 1.0; col[i * 6 + 2] = 0.25;
        col[i * 6 + 3] = 0.0; col[i * 6 + 4] = 1.0; col[i * 6 + 5] = 0.25;
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

// ── Edge particle flow ──
// When a node is selected, small glowing particles travel along its edges
// to visualise Nostr events flowing through the network.  Rendered as a
// single THREE.Points draw call for performance.

const MAX_PARTICLES = 200;

/** Circular glow texture for particles (module-level, created once). */
let particleTexture: THREE.Texture | null = null;
function getParticleTexture(): THREE.Texture {
  if (particleTexture) return particleTexture;
  const size = 64;
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(0,255,65,1)");
  g.addColorStop(0.3, "rgba(0,255,65,0.6)");
  g.addColorStop(1, "rgba(0,255,65,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  particleTexture = new THREE.CanvasTexture(canvas);
  return particleTexture;
}

function EdgeParticles({ simState }: { simState: React.RefObject<SimState | null> }) {
  const particlePos = useMemo(() => new Float32Array(MAX_PARTICLES * 3), []);
  const particleGeom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(particlePos, 3));
    return g;
  }, [particlePos]);

  const mat = useMemo(
    () =>
      new THREE.PointsMaterial({
        map: getParticleTexture(),
        size: 3,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [],
  );

  // Particle pool — mutable, not React state
  const poolRef = useRef<Particle[]>([]);
  const spawnTimerRef = useRef(0);
  const flashTimerRef = useRef(0);

  // Build edge endpoints list for spawnParticles (derived from sim links)
  const edgesRef = useRef<EdgeEndpoints[]>([]);

  useFrame((_, delta) => {
    const s = simState.current;
    if (!s) return;

    const ui = useUIStore.getState();
    const activeId = ui.selectedNodeId;
    const pool = poolRef.current;
    /* eslint-disable react-hooks/immutability -- Three.js buffer mutation in useFrame */
    const posAttr = particleGeom.attributes.position as THREE.BufferAttribute;
    const pos = posAttr.array as Float32Array;

    // Rebuild edge endpoints (cheap — just string coercions)
    if (edgesRef.current.length !== s.links.length) {
      edgesRef.current = s.links.map((link) => ({
        sourceId: String(typeof link.source === "object" ? link.source.id : link.source),
        targetId: String(typeof link.target === "object" ? link.target.id : link.target),
      }));
    }

    // ── Spawn new particles on active edges ──
    if (activeId) {
      spawnTimerRef.current += delta;
      if (spawnTimerRef.current > 0.12) {
        spawnTimerRef.current = 0;
        const spawned = spawnParticles(
          edgesRef.current,
          activeId,
          pool,
          MAX_PARTICLES,
          () => Math.random(),
        );
        pool.push(...spawned);
      }
    } else {
      spawnTimerRef.current = 0;
    }

    // ── Flash-triggered particles (subdued, lower frequency) ──
    flashTimerRef.current += delta;
    if (flashTimerRef.current > 0.3) {
      flashTimerRef.current = 0;
      const flashQueue = useActivityStore.getState().flashQueue;
      for (const pk of flashQueue) {
        if (pk === activeId) continue; // already handled above
        if (Math.random() > 0.3) continue; // 30% chance
        const spawned = spawnParticles(
          edgesRef.current,
          pk,
          pool,
          MAX_PARTICLES,
          () => Math.random(),
        );
        pool.push(...spawned);
      }
    }

    // ── Advance particles and write positions ──
    const alive = advanceParticles(pool, delta);

    for (let i = 0; i < alive; i++) {
      const p = pool[i];
      const link = s.links[p.linkIdx];
      if (!link) continue;
      const src = typeof link.source === "object" ? link.source : s.nodeMap.get(String(link.source));
      const tgt = typeof link.target === "object" ? link.target : s.nodeMap.get(String(link.target));
      if (!src || !tgt) continue;

      pos[i * 3] = lerp(src.x ?? 0, tgt.x ?? 0, p.t);
      pos[i * 3 + 1] = lerp(src.y ?? 0, tgt.y ?? 0, p.t);
      pos[i * 3 + 2] = lerp(src.z ?? 0, tgt.z ?? 0, p.t);
    }

    // Zero out remaining slots
    for (let i = alive; i < MAX_PARTICLES; i++) {
      pos[i * 3] = 0;
      pos[i * 3 + 1] = 0;
      pos[i * 3 + 2] = 0;
    }

    posAttr.needsUpdate = true;
    particleGeom.setDrawRange(0, alive);
    /* eslint-enable react-hooks/immutability */
  });

  return <points geometry={particleGeom} material={mat} />;
}

// ── Camera monitor ──

function CameraMonitor() {
  const lastCheckRef = useRef(0);
  const startTimeRef = useRef(0);
  useFrame(({ camera }) => {
    // Record mount time on first frame
    if (startTimeRef.current === 0) startTimeRef.current = Date.now();
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
        <ambientLight intensity={0.6} />
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
