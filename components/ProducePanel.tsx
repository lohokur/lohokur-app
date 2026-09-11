'use client';

import { useEffect, useRef, useState } from 'react';
import SamplePanel from '@/components/SamplePanel';
import ManufacturePanel from '@/components/ManufacturePanel';
import type { Techpack } from '@/lib/techpack';
import type { Sample } from '@/lib/sample';
import type { ChosenManufacturer } from '@/lib/manufacturers';
import type { Order } from '@/lib/order';

export type ProduceMode = 'sample' | 'bulk';

// The combined Produce node: one sample to hold, or a bulk factory run — same
// tech pack, one node. A toggle swaps between the sample and manufacture flows.
export default function ProducePanel({
  open,
  nodeId,
  techpack,
  techpacks,
  mode,
  sample,
  manufacturerId,
  order,
  hasShipNode,
  onModeChange,
  onSampleChange,
  onChooseManufacturer,
  onOrder,
  onShip,
  onClose,
}: {
  open: boolean;
  nodeId?: string | null;
  techpack?: Partial<Techpack>;
  techpacks?: Techpack[];
  mode: ProduceMode;
  sample?: Sample;
  manufacturerId?: string;
  order?: Order;
  hasShipNode?: boolean;
  onModeChange: (m: ProduceMode) => void;
  onSampleChange: (s: Sample) => void;
  onChooseManufacturer: (m: ChosenManufacturer) => void;
  onOrder: (o: Order) => void;
  onShip: () => void;
  onClose: () => void;
}) {
  // Stay mounted through the close so the panel slides OUT like the sketch pad
  // (unmounting immediately would just make it vanish). Keep rendering for the
  // length of the slide, then drop it.
  const [render, setRender] = useState(open);
  useEffect(() => {
    if (open) { setRender(true); return; }
    const t = setTimeout(() => setRender(false), 440); // matches the .4s slide + a hair
    return () => clearTimeout(t);
  }, [open]);

  // Freeze the displayed content while closing: the parent nulls out mode / order /
  // sample the instant it closes, which would flash blank data mid-slide-out.
  const snap = useRef({ mode, techpack, techpacks, sample, manufacturerId, order, hasShipNode });
  if (open) snap.current = { mode, techpack, techpacks, sample, manufacturerId, order, hasShipNode };
  const v = open ? { mode, techpack, techpacks, sample, manufacturerId, order, hasShipNode } : snap.current;

  if (!render) return null;

  const toggle = (
    <div className="prod-toggle" role="tablist" aria-label="Produce mode">
      <button role="tab" aria-selected={v.mode === 'sample'} className={v.mode === 'sample' ? 'on' : ''} onClick={() => onModeChange('sample')}>
        One sample
      </button>
      <button role="tab" aria-selected={v.mode === 'bulk'} className={v.mode === 'bulk' ? 'on' : ''} onClick={() => onModeChange('bulk')}>
        Bulk order
      </button>
    </div>
  );

  return v.mode === 'bulk' ? (
    <ManufacturePanel
      open={open}
      techpack={v.techpack}
      techpacks={v.techpacks}
      chosenId={v.manufacturerId}
      order={v.order}
      hasShipNode={v.hasShipNode}
      toggle={toggle}
      onChoose={onChooseManufacturer}
      onOrder={onOrder}
      onShip={onShip}
      onClose={onClose}
      onSwitchToSample={() => onModeChange('sample')}
    />
  ) : (
    <SamplePanel
      open={open}
      techpack={v.techpack}
      techpacks={v.techpacks}
      value={v.sample}
      hasShipNode={v.hasShipNode}
      order={v.order}
      toggle={toggle}
      onChange={onSampleChange}
      onOrder={onOrder}
      onShip={onShip}
      onClose={onClose}
    />
  );
}
