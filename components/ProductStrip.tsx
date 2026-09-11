'use client';

import type { Techpack } from '@/lib/techpack';

const heroOf = (tp: Partial<Techpack>) => tp.mockups?.front ?? tp.flats?.front ?? tp.references?.[0];
const nameOf = (tp: Partial<Techpack>) => (tp.name && tp.name !== 'Untitled garment' ? tp.name : 'Untitled');

// Shows the pieces wired into a Produce node — one card per connected tech pack,
// each with its render, name and (optionally) its own sample price.
export default function ProductStrip({
  products, prices, label,
}: {
  products: Partial<Techpack>[];
  prices?: (number | undefined)[]; // per-product sample price, if known
  label?: string;
}) {
  return (
    <div className="ps-wrap">
      {label && <div className="ps-label">{label}</div>}
      <div className="ps-row">
        {products.map((tp, i) => {
          const hero = heroOf(tp);
          return (
            <div className="ps-card" key={i}>
              <div className="ps-img">{hero ? <img src={hero} alt={nameOf(tp)} /> : <span>{i + 1}</span>}</div>
              <div className="ps-name" title={nameOf(tp)}>{nameOf(tp)}</div>
              {prices && prices[i] != null && <div className="ps-price">${prices[i]!.toLocaleString('en-US')}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
