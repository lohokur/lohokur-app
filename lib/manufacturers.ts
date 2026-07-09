// Recommended manufacturers + garment-specific sampling / bulk quoting.
// No real supplier API yet — a curated vetted list, with costs scaled to the
// connected garment's complexity (materials, trims, embellishment).

import type { Techpack } from '@/lib/techpack';

export type Manufacturer = {
  id: string;
  name: string;
  location: string;
  region: string;
  specialties: string[];
  moq: number;
  sampleBase: number; // USD, a plain garment
  unitBase: number;   // USD per unit at MOQ, a plain garment
  leadDays: number;
  rating: number;
  note: string;
};

export const MANUFACTURERS: Manufacturer[] = [
  {
    id: 'xuchang', name: 'Xuchang Apparel Co.', location: 'Dongguan, CN', region: 'China',
    specialties: ['Cut & sew', 'Fleece', 'Embellishment', 'Appliqué'], moq: 300,
    sampleBase: 120, unitBase: 14, leadDays: 35, rating: 4.7,
    note: 'Full-package factory, strong on complex embellished streetwear.',
  },
  {
    id: 'atelier-lin', name: 'Guangzhou Atelier Lin', location: 'Guangzhou, CN', region: 'China',
    specialties: ['Knitwear', 'Appliqué', 'Lace', 'Small batch'], moq: 150,
    sampleBase: 95, unitBase: 17, leadDays: 30, rating: 4.6,
    note: 'Lower MOQ, detail-led. Good for lace and hand-set trims.',
  },
  {
    id: 'porto-craft', name: 'Porto Craft Studio', location: 'Porto, PT', region: 'Europe',
    specialties: ['Cut & sew', 'Premium', 'Small runs', 'EU'], moq: 100,
    sampleBase: 180, unitBase: 32, leadDays: 28, rating: 4.8,
    note: 'EU-made, premium finish. Higher unit cost, lowest MOQ, tariff-free in EU.',
  },
  {
    id: 'istanbul-form', name: 'İstanbul Form Textile', location: 'Istanbul, TR', region: 'Turkey',
    specialties: ['Jersey', 'Fleece', 'Cut & sew', 'Mid runs'], moq: 250,
    sampleBase: 110, unitBase: 19, leadDays: 25, rating: 4.4,
    note: 'Fast turnaround to EU/UK, solid on fleece bodies.',
  },
  {
    id: 'tiruppur', name: 'Tiruppur Knit House', location: 'Tiruppur, IN', region: 'India',
    specialties: ['Cotton knits', 'Jersey', 'High volume'], moq: 500,
    sampleBase: 70, unitBase: 9, leadDays: 40, rating: 4.3,
    note: 'Best bulk pricing at volume. Simpler embellishment capability.',
  },
  {
    id: 'la-sample', name: 'LA Sample Room', location: 'Los Angeles, US', region: 'USA',
    specialties: ['Sampling', 'Small batch', 'Fast', 'Cut & sew'], moq: 50,
    sampleBase: 220, unitBase: 46, leadDays: 18, rating: 4.5,
    note: 'Domestic sampling & tiny runs. Expensive per unit, fastest sample.',
  },
];

export type GarmentBrief = {
  name?: string;
  category?: string;
  materials: number;
  trims: number;
  embellished: boolean;
  sizes: number;
};

const EMBELLISH = /lace|brooch|appliqu|gem|zip|embroid|bead|metal|trim|patch|stud|rhinest/i;

export function briefFromTechpack(tp?: Partial<Techpack>): GarmentBrief {
  const materials = tp?.materials?.length ?? 0;
  const trims = tp?.trims?.length ?? 0;
  const text = [
    ...(tp?.materials ?? []).flatMap((m) => [m.name, m.desc]),
    ...(tp?.trims ?? []).flatMap((t) => [t.type, t.desc]),
    tp?.subtitle,
  ].join(' ');
  return {
    name: tp?.name,
    category: tp?.category,
    materials,
    trims,
    embellished: materials >= 8 || EMBELLISH.test(text),
    sizes: tp?.sizes?.length ?? 0,
  };
}

export type Quote = Manufacturer & {
  sampleCost: number;
  unitCost: number;
  bulkTotal: number;
  matchScore: number;
  recommended: boolean;
  fit: string[];
};

// complexity multiplier for this garment vs a plain one
export function complexity(b: GarmentBrief): number {
  const c = 1 + 0.045 * Math.max(0, b.materials - 4) + 0.03 * Math.max(0, b.trims - 3) + (b.embellished ? 0.35 : 0);
  return Math.min(2.2, Math.max(1, c));
}

export function recommendFor(brief: GarmentBrief): Quote[] {
  const c = complexity(brief);
  const needs = new Set<string>(['cut & sew']);
  const cat = (brief.category ?? '').toLowerCase();
  if (/top|hood|sweat|jacket|knit/.test(cat)) { needs.add('knitwear'); needs.add('fleece'); }
  if (brief.embellished) { needs.add('appliqué'); needs.add('embellishment'); needs.add('lace'); }

  const quotes = MANUFACTURERS.map((m) => {
    const specs = m.specialties.map((s) => s.toLowerCase());
    const fit = [...needs].filter((n) => specs.some((s) => s.includes(n) || n.includes(s)));
    const matchScore = fit.length * 3 + m.rating;
    const sampleCost = Math.round((m.sampleBase * c) / 5) * 5;
    const unitCost = Math.round(m.unitBase * c * 2) / 2; // nearest $0.50
    return {
      ...m, fit,
      matchScore,
      recommended: false,
      sampleCost,
      unitCost,
      bulkTotal: Math.round(unitCost * m.moq),
    };
  });

  quotes.sort((a, b) => b.matchScore - a.matchScore || a.unitCost - b.unitCost);
  quotes.slice(0, 2).forEach((q) => (q.recommended = true));
  return quotes;
}

export type ChosenManufacturer = {
  id: string;
  name: string;
  location: string;
  sampleCost: number;
  unitCost: number;
  moq: number;
  leadDays: number;
};

// Same vetted list, re-ranked for making ONE sample: sampling capability,
// speed, then sample cost. Bulk MOQ is irrelevant here.
export function samplersFor(brief: GarmentBrief): Quote[] {
  const base = recommendFor(brief);
  const score = (q: Quote) =>
    (q.specialties.some((s) => /sampl|small batch|fast/i.test(s)) ? 100 : 0) - q.leadDays - q.sampleCost / 50 + q.rating;
  return [...base]
    .sort((a, b) => score(b) - score(a))
    .map((q, i) => ({ ...q, recommended: i < 2 }));
}
