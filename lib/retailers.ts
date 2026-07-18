// Stockists a finished collection can be submitted to — online marketplaces,
// physical boutiques, or both. Highly curated retailers (Dover Street Market,
// SSENSE…) gate on approval, so a submission sits "pending" until a review
// decision comes back. No real retailer API yet — a curated demo list with a
// simulated, deterministic curation outcome. (Iron out later: real submissions.)

export type RetailerKind = 'online' | 'physical' | 'both';

export type Retailer = {
  id: string;
  name: string;
  location: string;
  region: string;
  kind: RetailerKind;
  curated: boolean;      // requires an approval/review step before stocking
  acceptanceRate: number; // 0–1, rough odds a submission is accepted (curated only)
  aesthetic: string[];    // vibes the buyer leans toward
  note: string;
};

// Hero example: "have them stocked at Dover Street Market" → the DSM card, curated.
export const RETAILERS: Retailer[] = [
  {
    id: 'dsm', name: 'Dover Street Market', location: 'London · global', region: 'Global',
    kind: 'both', curated: true, acceptanceRate: 0.18,
    aesthetic: ['avant-garde', 'conceptual', 'directional', 'luxury'],
    note: 'The benchmark curated space. Buyers hand-pick every label — hard to get in, defining once you are.',
  },
  {
    id: 'ssense', name: 'SSENSE', location: 'Montreal, CA', region: 'Global',
    kind: 'online', curated: true, acceptanceRate: 0.22,
    aesthetic: ['contemporary', 'streetwear', 'designer', 'editorial'],
    note: 'Global online authority. Strong editorial reach; wholesale + consignment models.',
  },
  {
    id: 'selfridges', name: 'Selfridges', location: 'London, UK', region: 'UK',
    kind: 'physical', curated: true, acceptanceRate: 0.20,
    aesthetic: ['luxury', 'statement', 'commercial-luxury'],
    note: 'Department-store scale with a real emerging-designer program (Corner Shop).',
  },
  {
    id: 'machine-a', name: 'Machine-A', location: 'London, UK', region: 'UK',
    kind: 'both', curated: true, acceptanceRate: 0.30,
    aesthetic: ['avant-garde', 'graduate', 'experimental'],
    note: 'Concept store that champions graduate and experimental designers. More reachable entry point.',
  },
  {
    id: 'antonioli', name: 'Antonioli', location: 'Milan, IT', region: 'Europe',
    kind: 'both', curated: true, acceptanceRate: 0.28,
    aesthetic: ['directional', 'luxury', 'dark'],
    note: 'European luxury multi-brand, strong on directional and darker labels.',
  },
  {
    id: 'shopify', name: 'Your own store', location: 'Direct-to-customer', region: 'Global',
    kind: 'online', curated: false, acceptanceRate: 1,
    aesthetic: ['any'],
    note: 'List straight to your own storefront — no gatekeeping, you keep the full margin.',
  },
  {
    id: 'etsy', name: 'Etsy', location: 'Online marketplace', region: 'Global',
    kind: 'online', curated: false, acceptanceRate: 1,
    aesthetic: ['handmade', 'independent', 'craft'],
    note: 'Open marketplace. Instant listing, built-in traffic, best for made-to-order and small runs.',
  },
  {
    id: 'depop', name: 'Depop', location: 'Online marketplace', region: 'Global',
    kind: 'online', curated: false, acceptanceRate: 1,
    aesthetic: ['youth', 'streetwear', 'vintage-adjacent'],
    note: 'Social resale-style marketplace. Instant listing, Gen-Z audience.',
  },
];

// What's known about the collection being submitted (from the connected pipeline).
export type CollectionBrief = {
  name?: string;
  category?: string;
  pieces: number;       // how many styles in the collection
  polished: boolean;    // has it been through techpack + manufacture (submission-ready)?
};

export type RetailerMatch = Retailer & {
  fit: string[];        // aesthetic tags that line up with the collection
  matchScore: number;
  recommended: boolean;
  odds: number;         // adjusted acceptance odds for THIS collection (curated only)
};

// tiny stable hash so a submission's outcome is deterministic per (retailer, collection)
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967295; // 0–1
}

export function matchRetailers(brief: CollectionBrief): RetailerMatch[] {
  const cat = (brief.category ?? '').toLowerCase();
  const wants = new Set<string>();
  if (/leather|jacket|moto|coat|outer/.test(cat)) { wants.add('directional'); wants.add('luxury'); wants.add('avant-garde'); }
  if (/street|hood|cargo|techwear/.test(cat)) { wants.add('streetwear'); wants.add('youth'); }

  const matches = RETAILERS.map((r) => {
    const fit = r.aesthetic.filter((a) => wants.has(a));
    // polished collections do better with curated buyers; readiness nudges the odds
    const readiness = brief.polished ? 0.06 : -0.05;
    const fitBonus = fit.length * 0.04;
    const odds = r.curated ? Math.min(0.6, Math.max(0.05, r.acceptanceRate + readiness + fitBonus)) : 1;
    const matchScore = fit.length * 3 + (brief.polished ? 1 : 0) + (r.curated ? 0.5 : 0);
    return { ...r, fit, matchScore, recommended: false, odds };
  });

  matches.sort((a, b) => b.matchScore - a.matchScore || b.acceptanceRate - a.acceptanceRate);
  matches.slice(0, 2).forEach((m) => (m.recommended = true));
  return matches;
}

export type SubmissionStatus = 'draft' | 'pending' | 'accepted' | 'rejected' | 'listed';

// What gets stored on the retailer node.
export type ChosenRetailer = {
  id: string;
  name: string;
  location: string;
  kind: RetailerKind;
  curated: boolean;
  status: SubmissionStatus;
  submittedAt?: number;
  decidedAt?: number;
};

// Simulate the curation decision — deterministic so "check status" is stable.
export function reviewOutcome(retailerId: string, collectionName: string): 'accepted' | 'rejected' {
  const r = RETAILERS.find((x) => x.id === retailerId);
  const odds = r?.acceptanceRate ?? 0.2;
  return hash(retailerId + '::' + (collectionName || 'untitled')) < odds ? 'accepted' : 'rejected';
}

export function statusLabel(s: SubmissionStatus): string {
  return { draft: 'Not submitted', pending: 'Awaiting review', accepted: 'Accepted', rejected: 'Not this season', listed: 'Listed' }[s];
}
