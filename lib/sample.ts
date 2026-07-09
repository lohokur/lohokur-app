// "Create Sample" — make ONE sample of the garment, independent of any bulk order.
// Pick a sampler, set quantity + a ship-to address (optional — or route to a Ship
// node), and track it through a simple status lifecycle.

export type SampleStatus = 'draft' | 'requested' | 'in_production' | 'shipped' | 'received' | 'approved';

export const SAMPLE_STATUSES: { key: SampleStatus; label: string }[] = [
  { key: 'draft', label: 'Draft' },
  { key: 'requested', label: 'Requested' },
  { key: 'in_production', label: 'In production' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'received', label: 'Received' },
  { key: 'approved', label: 'Approved' },
];

export type Address = {
  name: string;
  line1: string;
  line2: string;
  city: string;
  region: string;
  postcode: string;
  country: string;
};

export type Sample = {
  samplerId?: string;
  samplerName?: string;
  samplerLocation?: string;
  sampleCost?: number;
  leadDays?: number;
  qty: number;
  address: Address;
  status: SampleStatus;
};

export function emptyAddress(): Address {
  return { name: '', line1: '', line2: '', city: '', region: '', postcode: '', country: '' };
}

export function defaultSample(): Sample {
  return { qty: 1, address: emptyAddress(), status: 'draft' };
}

export const statusLabel = (s: SampleStatus) => SAMPLE_STATUSES.find((x) => x.key === s)?.label ?? s;
