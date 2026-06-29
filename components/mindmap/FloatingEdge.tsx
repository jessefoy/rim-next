import { getBezierPath, useInternalNode, type EdgeProps } from "@xyflow/react";
import { getEdgeParams } from "./floatingEdgeUtils";

/**
 * A branch line that attaches to the nearest border of each topic and recomputes
 * as nodes move (see floatingEdgeUtils). Rendered via the `floating` edge type.
 */
export default function FloatingEdge({ id, source, target, markerEnd, style }: EdgeProps) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  if (!sourceNode || !targetNode) return null;

  const { sx, sy, tx, ty, sourcePos, targetPos } = getEdgeParams(sourceNode, targetNode);
  const [path] = getBezierPath({
    sourceX: sx,
    sourceY: sy,
    sourcePosition: sourcePos,
    targetPosition: targetPos,
    targetX: tx,
    targetY: ty,
  });

  return <path id={id} className="react-flow__edge-path" d={path} markerEnd={markerEnd} style={style} />;
}
