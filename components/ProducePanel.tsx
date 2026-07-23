'use client';

import SamplePanel from '@/components/SamplePanel';
import ManufacturePanel from '@/components/ManufacturePanel';
import type { Techpack } from '@/lib/techpack';
import type { Sample } from '@/lib/sample';
import type { ChosenManufacturer } from '@/lib/manufacturers';

export type ProduceMode = 'sample' | 'bulk';

// The combined Produce node: one sample to hold, or a bulk factory run — same
// tech pack, one node. A toggle swaps between the sample and manufacture flows.
export default function ProducePanel({
  open,
  nodeId,
  techpack,
  mode,
  sample,
  manufacturerId,
  hasShipNode,
  onModeChange,
  onSampleChange,
  onChooseManufacturer,
  onClose,
}: {
  open: boolean;
  nodeId?: string | null;
  techpack?: Partial<Techpack>;
  mode: ProduceMode;
  sample?: Sample;
  manufacturerId?: string;
  hasShipNode?: boolean;
  onModeChange: (m: ProduceMode) => void;
  onSampleChange: (s: Sample) => void;
  onChooseManufacturer: (m: ChosenManufacturer) => void;
  onClose: () => void;
}) {
  if (!open) return null;

  const toggle = (
    <div className="prod-toggle" role="tablist" aria-label="Produce mode">
      <button role="tab" aria-selected={mode === 'sample'} className={mode === 'sample' ? 'on' : ''} onClick={() => onModeChange('sample')}>
        One sample
      </button>
      <button role="tab" aria-selected={mode === 'bulk'} className={mode === 'bulk' ? 'on' : ''} onClick={() => onModeChange('bulk')}>
        Bulk order
      </button>
    </div>
  );

  return mode === 'bulk' ? (
    <ManufacturePanel
      open={open}
      techpack={techpack}
      chosenId={manufacturerId}
      toggle={toggle}
      onChoose={onChooseManufacturer}
      onClose={onClose}
    />
  ) : (
    <SamplePanel
      open={open}
      techpack={techpack}
      value={sample}
      hasShipNode={hasShipNode}
      toggle={toggle}
      onChange={onSampleChange}
      onClose={onClose}
    />
  );
}
