import { Position, type InternalNode } from "@xyflow/react";

/**
 * Floating-edge geometry (the React Flow "floating edges" recipe, adapted for
 * v12's InternalNode shape). Instead of pinning a line to a fixed handle, we
 * compute where the line crosses each node's border given the two nodes' live
 * positions — so connections attach to the nearest edge and follow nodes as
 * they're dragged. This is the fix for the POC's "lines up funny."
 */

function nodeCenter(node: InternalNode) {
  const pos = node.internals.positionAbsolute;
  const w = node.measured?.width ?? 0;
  const h = node.measured?.height ?? 0;
  return { x: pos.x + w / 2, y: pos.y + h / 2, w, h };
}

/** The point on `node`'s border that lies on the line toward `toward`. */
function getNodeIntersection(node: InternalNode, toward: InternalNode) {
  const { x: x2, y: y2, w, h } = nodeCenter(node);
  const { x: x1, y: y1 } = nodeCenter(toward);
  const halfW = w / 2;
  const halfH = h / 2;
  if (halfW === 0 || halfH === 0) return { x: x2, y: y2 };

  const xx1 = (x1 - x2) / (2 * halfW) - (y1 - y2) / (2 * halfH);
  const yy1 = (x1 - x2) / (2 * halfW) + (y1 - y2) / (2 * halfH);
  const a = 1 / (Math.abs(xx1) + Math.abs(yy1) || 1);
  const xx3 = a * xx1;
  const yy3 = a * yy1;
  return { x: halfW * (xx3 + yy3) + x2, y: halfH * (-xx3 + yy3) + y2 };
}

function getEdgePosition(node: InternalNode, point: { x: number; y: number }): Position {
  const pos = node.internals.positionAbsolute;
  const w = node.measured?.width ?? 0;
  const h = node.measured?.height ?? 0;
  const px = Math.round(point.x);
  const py = Math.round(point.y);
  const nx = Math.round(pos.x);
  const ny = Math.round(pos.y);
  if (px <= nx + 1) return Position.Left;
  if (px >= nx + w - 1) return Position.Right;
  if (py <= ny + 1) return Position.Top;
  if (py >= ny + h - 1) return Position.Bottom;
  return Position.Top;
}

export function getEdgeParams(source: InternalNode, target: InternalNode) {
  const sourcePoint = getNodeIntersection(source, target);
  const targetPoint = getNodeIntersection(target, source);
  return {
    sx: sourcePoint.x,
    sy: sourcePoint.y,
    tx: targetPoint.x,
    ty: targetPoint.y,
    sourcePos: getEdgePosition(source, sourcePoint),
    targetPos: getEdgePosition(target, targetPoint),
  };
}
