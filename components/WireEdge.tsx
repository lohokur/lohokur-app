'use client';

import { getBezierPath, type EdgeProps } from '@xyflow/react';

// Connector styled like the landing "one canvas" example: a faint mint bezier
// with a bright mint pulse (a streak of light) travelling along it.
export default function WireEdge({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition }: EdgeProps) {
  const [path] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  return (
    <>
      <path d={path} className="wire-base" fill="none" />
      <path d={path} className="wire-pulse" fill="none" />
    </>
  );
}
