'use client';

import { useEffect, useState } from 'react';
import ExtractPanel from '@/components/ExtractPanel';
import PatternPanel from '@/components/PatternPanel';

// The combined Pattern maker: first EXTRACT the garment off the look, then the
// pattern is traced automatically from what you extracted — all in one node.
export default function PatternMakerPanel({
  open,
  nodeId,
  image,
  onGenerated,
  onClose,
}: {
  open: boolean;
  nodeId?: string | null;
  image?: string;
  onGenerated: (dataUrl: string) => void;
  onClose: () => void;
}) {
  const [extracted, setExtracted] = useState<string | null>(null);

  // reset to the extract step whenever a different node opens
  useEffect(() => { setExtracted(null); }, [nodeId, open]);

  if (!open) return null;

  // Phase 1 — pick the garment (or use the whole image if it's already flat).
  if (!extracted) {
    return (
      <ExtractPanel
        open={open}
        image={image}
        title="Pattern maker · extract"
        onExtracted={setExtracted}
        onUseWhole={() => image && setExtracted(image)}
        onClose={onClose}
      />
    );
  }

  // Phase 2 — trace the pattern automatically from the extracted piece.
  return (
    <PatternPanel
      open={open}
      nodeId={nodeId}
      image={extracted}
      autoStart
      onGenerated={onGenerated}
      onClose={onClose}
    />
  );
}
