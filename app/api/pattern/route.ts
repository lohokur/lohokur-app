import { NextResponse } from 'next/server';
import { editImage } from '@/lib/imagegen';
import { usesProModel } from '@/lib/entitlements';
import { consumeGeneration, refundGeneration } from '@/lib/billing-server';

export const maxDuration = 300;

// The pattern node builds up in stages:
//   outline     — trace the visualised garment into a flat 2D outline (blue/red, hollow)
//   refine      — compare the outline to the real garment; ADD missing lines, CLEAR fill
//   deconstruct — detach the garment into its individual, separated pattern panels
//   number      — number every "whole shape" (closed panel)
// refine takes TWO inputs [garment, currentOutline]; the others take one.

const OUTLINE_PROMPT = [
  'From this garment image, produce a clean 2D LINE DRAWING of the outline of the garment — a flat technical fashion sketch, drawn flat and front-on as if laid out.',
  'Draw ONLY the boundary contours: the outer silhouette plus the seam lines that divide the garment into its individual panels. Each line is a single, thin, clean, continuous CONTOUR stroke.',
  'COLOUR-CODE the outlines by material: draw the outline of every panel made from the PRIMARY (main / dominant body) material in BLUE, and the outline of every panel made from a SECONDARY (different) material in RED.',
  'Judge primary vs secondary from the fabrics in the photo: the main body fabric is primary (blue); ribbed cuffs / waistband / collar, contrast panels, trims or lining in a different fabric are secondary (red).',
  'CRITICAL — the inside of every panel must be COMPLETELY EMPTY solid white. Absolutely NO fill of any kind and NO internal linework whatsoever:',
  'NO fabric texture, NO material weave, NO mesh, NO net, NO grid, NO lattice, NO hatching, NO cross-hatching, NO stippling, NO dots, NO ribbing lines, NO knit texture, NO topstitching, NO wrinkles, NO folds, NO shadows, NO shading, NO gradient, NO tone, NO colour fill.',
  'Do not render what the fabric looks like — ignore the material texture entirely. Only the flat panel boundary outlines exist; everything inside a boundary is blank white paper.',
  'Pure white background. NO human figure, NO background scenery, NO text — only the thin blue and red panel outlines on white.',
  "Keep the garment's true proportions, silhouette and seam placement. Centre it with a little margin.",
].join(' ');

const NUMBER_PROMPT = [
  'You are given a flat 2D outline drawing of a single garment on a white background, with panels outlined in blue (primary material) and red (secondary material).',
  'Find every WHOLE SHAPE — each fully closed, self-contained outlined region that is a distinct construction panel (for example: body, left sleeve, right sleeve, hood, pocket, each cuff, waistband/hem band).',
  'Place a single clear number inside each whole shape, numbered sequentially 1, 2, 3, … — every closed panel gets exactly one number, positioned in the visual centre of that shape.',
  'Do NOT number internal detail lines — topstitching, seam lines that run within a shape, zippers, drawcords. ONLY complete enclosed shapes get a number.',
  'Keep the existing coloured (blue/red) outline EXACTLY as it is — do not recolour, redraw, restyle or move any line, and keep every panel hollow. Only ADD the numbers on top.',
  'Numbers must be clean, legible, solid black, upright, of even size. Pure white background, no other text, labels, legends or arrows.',
].join(' ');

const REFINE_PROMPT = [
  'You are given TWO images. The FIRST is a real photo of a garment. The SECOND is a flat 2D outline line-drawing of that same garment (thin blue lines = primary-material panels, red lines = secondary-material panels; panels are hollow).',
  'Carefully COMPARE the outline against the real garment and COMPLETE the outline: add any construction lines or panels that are MISSING or were left out — cuffs, hems, waistband / hem band, collar / neckband, hood, pockets, plackets, zip or button openings, yokes, and any seam that divides one panel from another.',
  'Draw every addition in the SAME style: thin, single-weight, continuous blue (primary) or red (secondary) contour lines, hollow, matching the existing linework.',
  'KEEP every existing correct BOUNDARY line exactly as it is — do NOT remove, move or redraw the panel outlines that are already right; only ADD missing outlines.',
  'ALSO CLEAN THE PANELS: if any panel contains fill, colour, shading, or internal texture (mesh, net, grid, weave, hatching, cross-hatching, stippling, knit/ribbing lines, wrinkles, folds), REMOVE all of it so the inside of that shape becomes blank solid white.',
  'The end result: every panel is HOLLOW — only the thin blue/red boundary contours remain, and the inside of every shape is completely EMPTY solid white. NO fill or texture anywhere.',
  'Output ONLY the completed, cleaned flat outline on a pure white background — no human figure, no background, no text.',
].join(' ');

const DECONSTRUCT_PROMPT = [
  'You are given a flat 2D outline drawing of a single garment on a white background (thin blue lines = primary-material panels, red lines = secondary-material panels; panels are hollow).',
  'DECONSTRUCT the garment into its individual PATTERN PANELS: take each closed panel and DETACH it from the others, as if the garment were unpicked at every seam and the pieces laid out flat.',
  'Arrange all the separated panels flat on a pure white background, fully spaced apart so none touch or overlap, in a neat even layout.',
  "Keep each panel's exact shape and proportion, and keep its outline colour (blue for primary, red for secondary).",
  'Every panel stays HOLLOW — thin coloured boundary outline ONLY. NO fill, NO fabric texture, NO mesh, NO hatching, NO shading, NO tone inside any panel; the inside of every piece is blank solid white.',
  'Output ONLY the detached panel outlines on pure white — no human figure, no background, no text, no connecting lines between pieces.',
].join(' ');

const PROMPTS: Record<string, string> = {
  outline: OUTLINE_PROMPT,
  refine: REFINE_PROMPT,
  deconstruct: DECONSTRUCT_PROMPT,
  number: NUMBER_PROMPT,
};

export async function POST(req: Request) {
  const { image, ref, mode } = await req.json().catch(() => ({}));
  const prompt = PROMPTS[mode as string] ?? OUTLINE_PROMPT;
  if (!image) return NextResponse.json({ error: 'missing garment image' }, { status: 400 });
  // refine needs both the real garment and the current outline to spot omissions.
  if (mode === 'refine' && !ref) return NextResponse.json({ error: 'missing outline to refine' }, { status: 400 });
  const inputs = mode === 'refine' ? [image, ref] : [image];

  const gate = await consumeGeneration(2); // pattern generation drinks more ink than a visualise
  if (!gate.ok) {
    return NextResponse.json(
      { error: gate.reason === 'unauth' ? 'sign in required' : 'monthly generation limit reached', upgrade: gate.reason === 'over' },
      { status: gate.reason === 'unauth' ? 401 : 402 },
    );
  }

  try {
    const out = await editImage(prompt, inputs, usesProModel(gate.tier));
    return NextResponse.json({ image: out });
  } catch (e) {
    await refundGeneration(2);
    return NextResponse.json({ error: (e as Error).message || 'pattern generation failed' }, { status: 500 });
  }
}
