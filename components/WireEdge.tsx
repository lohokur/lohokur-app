'use client';

import { getBezierPath, type EdgeProps } from '@xyflow/react';

// Connector styled like the landing "one canvas" example: a faint mint bezier
// with a bright mint pulse (a streak of light) travelling along it.
export default function WireEdge({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, selected }: EdgeProps) {
  const [path] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  return (
    <>
      {/* wide invisible hit-area so the thin wire is easy to click / select (then Delete) */}
      <path d={path} className="react-flow__edge-interaction" fill="none" stroke="transparent" strokeWidth={22} />
      <path d={path} className={`wire-base${selected ? ' selected' : ''}`} fill="none" />
      <path d={path} className="wire-pulse" fill="none" />
    </>
  );
}
