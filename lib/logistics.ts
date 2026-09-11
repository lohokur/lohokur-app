// Ship node: send the finished product to a whitelisted 3PL fulfilment partner,
// or to any address the user types in. No real carrier API yet — a curated list
// of real 3PLs; handing an order off mints a (simulated) tracking number.

import { type Address, emptyAddress } from '@/lib/sample';

export type Threepl = {
  id: string;
  name: string;
  location: string;
  coverage: string; // where they fulfil to
  note: string;
};

// Whitelisted fulfilment partners — the ones we actually use.
export const THREEPLS: Threepl[] = [
  { id: 'holistic', name: 'Holistic Fulfilment', location: 'United Kingdom', coverage: 'UK & EU', note: 'Holds your stock, picks & packs, ships Royal Mail / courier.' },
  { id: 'tapstitch', name: 'Tapstitch', location: 'Worldwide (POD)', coverage: 'Worldwide', note: 'Print-on-demand — makes & ships each order individually.' },
];

export type ShipDest =
  | { kind: 'address'; address: Address }
  | { kind: '3pl'; id: string; name: string; location: string };

export type ShipTo = {
  dest?: ShipDest;
  confirmedAt?: number;
};

export function defaultShipTo(): ShipTo {
  return {};
}

export function destLabel(dest?: ShipDest): string {
  if (!dest) return '';
  if (dest.kind === '3pl') return dest.name;
  const a = dest.address;
  return [a.name, a.line1, a.city, a.country].filter(Boolean).join(', ') || 'Custom address';
}

export function blankAddress(): Address {
  return emptyAddress();
}
