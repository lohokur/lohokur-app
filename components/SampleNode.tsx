'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useStudio } from '@/lib/studio-context';
import { OpenIcon } from '@/components/ActionArrow';
import NodeArt from '@/components/NodeArt';
import { seedFrom } from '@/lib/node-art';
import { type Sample } from '@/lib/sample';
import type { ChosenManufacturer } from '@/lib/manufacturers';
import type { ProduceMode } from '@/components/ProducePanel';
import { type Order, orderProgress, currentStageLabel, isComplete } from '@/lib/order';

// Produce: one sample to hold, or a bulk factory run — one node, one tech pack.
export default function SampleNode({ id, data, selected }: NodeProps) {
  const { openSample } = useStudio();
  const d = data as { sample?: Sample; manufacturer?: ChosenManufacturer; produceMode?: ProduceMode; order?: Order; productImage?: string; productName?: string; techpackReady?: boolean };
  const mode: ProduceMode = d.produceMode ?? 'sample';
  const s = d.sample;
  const m = d.manufacturer;
  const order = d.order;
  const inProd = !!order && !isComplete(order);
  const product = d.productImage; // the upstream render of the piece being made
  const pName = d.productName ?? 'Your piece'; // the garment name
  const ready = !!d.techpackReady; // a fully generated tech pack is plugged in
  // the chosen factory/sampler name — drives the "handed to the factory" state
  const mfName = order?.manufacturerName ?? (mode === 'bulk' ? m?.name : s?.samplerName);

  return (
    <div className={`fbnode produce-node${selected ? ' selected' : ''}`}>
      <Handle type="target" position={Position.Left} className="sn-handle" />

      <div className="fb-canvas fb-info" onClick={() => openSample(id)}>
        <NodeArt seed={seedFrom(id)} animate={inProd && !product} />
        {product && <img className="produce-photo" src={product} alt="" />}
        {product && <div className="produce-photo-scrim" aria-hidden="true" />}
        {!product && <svg className="fb-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 8l-9-5-9 5v8l9 5 9-5z" /><path d="M3 8l9 5 9-5M12 13v9" /></svg>}
        {order ? (
          <>
            <strong>{order.status === 'shipped' ? 'Shipped' : isComplete(order) ? 'Production complete' : currentStageLabel(order)}</strong>
            <span className="produce-handoff"><span className="ph-pulse" aria-hidden="true" />{order.manufacturerName} · {order.mode === 'bulk' ? 'bulk' : 'sample'}</span>
            <div className="pn-bar"><div className="pn-bar-fill" style={{ width: `${Math.round(orderProgress(order) * 100)}%` }} /></div>
          </>
        ) : !ready ? (
          <strong className="node-empty-title">Plug in a completed tech pack to produce.</strong>
        ) : mfName ? (
          <>
            <strong>{pName} is ready for production</strong>
            <div className="produce-pay-wrap nodrag">
              <div className="pn-bar"><div className="pn-bar-fill pn-bar-pending" /></div>
              <button className="produce-pay" onClick={(e) => { e.stopPropagation(); openSample(id); }}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
                Pay now
              </button>
            </div>
          </>
        ) : (
          <>
            <strong>{pName} is ready to produce</strong>
            <div className="produce-pay-wrap nodrag">
              <button className="produce-pay" onClick={(e) => { e.stopPropagation(); openSample(id); }}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21h18" /><path d="M5 21v-9l4 2.5V12l4 2.5V12l4 2.5V8l2 1.5V21" /></svg>
                Select factory
              </button>
            </div>
          </>
        )}
      </div>

      <span className="fb-tag">Produce</span>

      <div className="fb-tools">
        <button className="fb-tool nodrag" onClick={(e) => { e.stopPropagation(); openSample(id); }} title="Set up production" aria-label="Set up production"><OpenIcon /></button>
      </div>

      <Handle type="source" position={Position.Right} className="sn-handle" />
    </div>
  );
}
