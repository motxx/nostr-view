import { useCallback } from "react";
import { type ThreeEvent } from "@react-three/fiber";
import { influenceToColor, influenceToSize, tierBrightness } from "@/lib/graph-math";
import { SignalSprite } from "./visuals/SignalSprite";
import { AvatarSphere } from "./visuals/AvatarSphere";
import { LabelSprite } from "./visuals/LabelSprite";
import { RadarPulse } from "./visuals/RadarPulse";
import type { GraphNodeData } from "./graph-types";

export function GraphNode({
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
