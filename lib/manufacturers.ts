// Recommended manufacturers + garment-specific sampling / bulk quoting.
// Our real white-label suppliers only — costs scaled to the connected garment's
// complexity (materials, trims, embellishment). Contact (email/WhatsApp) is set
// per order in the liaison step, so it's intentionally left off the directory.

import type { Techpack } from '@/lib/techpack';
import { samplePrice, bulkUnitPrice } from '@/lib/pricing';

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
  email?: string;    // liaison-agent contact (optional — user can set per order)
  whatsapp?: string; // E.164, e.g. +8613800138000
  photos?: string[]; // real factory-floor photos (representative), shown on the card
  vetted?: boolean;  // reviewed + worked with directly by LOHO KUR
  about?: string;    // context shown in the "more info" dropdown
  ethics?: string;   // ethics / working-conditions / vetting note
};

export const MANUFACTURERS: Manufacturer[] = [
  {
    id: 'xuchang', name: 'Xuchang Apparel Co.', location: 'Dongguan, CN', region: 'China',
    specialties: ['Cut & sew', 'Fleece', 'Embellishment', 'Appliqué'], moq: 300,
    sampleBase: 120, unitBase: 14, leadDays: 35, rating: 4.7,
    note: 'Full-package factory, strong on complex embellished streetwear.',
    photos: ['/manufacturers/xuchang.jpg', '/manufacturers/factory-3.jpg'],
    vetted: true,
    about: 'A full-package cut-and-sew factory in Dongguan that handles sampling through to bulk under one roof — strong on fleece bodies, appliqué and embellishment. We ran a full production order here, so we know the quality, communication and turnaround first-hand.',
    ethics: 'We only list makers we have worked with directly. Fair pay and safe working conditions are written into our supplier agreement, and turnaround is confirmed against a real order.',
  },
  {
    id: 'xufei', name: 'Xufei Tech', location: 'Mainland China', region: 'China',
    specialties: ['Cut & sew', 'OEM/ODM', 'Full-package', 'Embellishment'], moq: 200,
    sampleBase: 100, unitBase: 13, leadDays: 32, rating: 4.5,
    note: 'Alibaba verified supplier (xufeitech.en.alibaba.com). Confirm capabilities, MOQ & quote before ordering.',
    photos: ['/manufacturers/xufei.jpg', '/manufacturers/factory-4.jpg'],
    vetted: true,
    about: 'An Alibaba-verified OEM/ODM cut-and-sew supplier offering full-package production with lower minimums — a good fit for embellished pieces and smaller runs.',
    ethics: 'Alibaba Verified Supplier status, plus our own checks: we confirm capabilities, MOQ and an approved sample before any bulk order goes ahead.',
  },
];

// First factory photo for a manufacturer id — used to show the chosen supplier on the node card.
export function manufacturerPhoto(id?: string | null): string | undefined {
  if (!id) return undefined;
  return MANUFACTURERS.find((m) => m.id === id)?.photos?.[0];
}

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
    // sampleBase / unitBase are the ESTIMATED FACTORY cost; the customer price is
    // that run through the loss-proof cost-plus model (buffer + shipping + margin
    // + Stripe gross-up + floor). See lib/pricing.ts.
    const sampleCost = samplePrice(m.sampleBase * c);
    const unitCost = bulkUnitPrice(m.unitBase * c);
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
