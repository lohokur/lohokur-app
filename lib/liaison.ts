import 'server-only';
import { PRODUCTION_STAGES } from '@/lib/order';

// The liaison agent's "brain": drafts outreach to a manufacturer and parses their
// replies into production-stage updates. Runs on OpenAI (same key as the tech pack).

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

async function chatJSON(system: string, user: string): Promise<Record<string, unknown>> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY not configured');
  const r = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: process.env.OPENAI_LIAISON_MODEL || 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      max_tokens: 900,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    }),
  });
  if (!r.ok) throw new Error(`openai ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  const text: string = j?.choices?.[0]?.message?.content ?? '{}';
  try { return JSON.parse(text); } catch { return {}; }
}

const str = (x: unknown) => (typeof x === 'string' ? x.trim() : '');

export type Outreach = { subject: string; body: string; whatsapp: string };

// Draft the first message to a manufacturer to place / kick off an order.
export async function draftOutreach(input: {
  product: string; mode: 'sample' | 'bulk'; qty: number; manufacturerName: string;
}): Promise<Outreach> {
  const system =
    "You are LOHO KUR's sourcing manager. Write a concise, professional first message to a garment manufacturer to place an order. " +
    'Be specific and courteous. Ask them to (1) confirm they can make it, (2) give a lead time, and (3) reply with an ORDER NUMBER so we can track it. ' +
    'Return ONLY JSON: {"subject": string, "body": string, "whatsapp": string}. "body" = the email body (plain text, a few short paragraphs, sign off as "LOHO KUR Sourcing"). "whatsapp" = a shorter one-paragraph version for WhatsApp.';
  const user = `Manufacturer: ${input.manufacturerName}\nOrder type: ${input.mode === 'bulk' ? 'bulk production run' : 'single sample'}\nQuantity: ${input.qty}\nProduct: ${input.product || 'a garment (tech pack attached separately)'}`;
  const o = await chatJSON(system, user);
  return {
    subject: str(o.subject) || `LOHO KUR — ${input.mode} order enquiry`,
    body: str(o.body) || `Hi ${input.manufacturerName}, we'd like to place a ${input.mode} order for ${input.qty} unit(s) of ${input.product}. Can you confirm, share a lead time, and reply with an order number? Thanks, LOHO KUR Sourcing`,
    whatsapp: str(o.whatsapp) || `Hi ${input.manufacturerName} — LOHO KUR here. We'd like a ${input.mode} order: ${input.qty}× ${input.product}. Can you confirm, give a lead time, and an order number? Thanks!`,
  };
}

export type ParsedReply = {
  stageKey: string;        // one of PRODUCTION_STAGES keys, or ''
  note: string;            // one-line summary of the manufacturer's message
  factoryOrderNo?: string;
  trackingNumber?: string;
  carrier?: string;
};

// Parse a manufacturer's reply into a structured production update.
export async function parseReply(reply: string): Promise<ParsedReply> {
  const stageList = PRODUCTION_STAGES.map((s) => `${s.key} (${s.label})`).join(', ');
  const system =
    'You read a garment manufacturer\'s message and extract the production status. ' +
    `The production stages, in order, are: ${stageList}. ` +
    'Return ONLY JSON: {"stageKey": string, "note": string, "factoryOrderNo": string, "trackingNumber": string, "carrier": string}. ' +
    'stageKey = the CURRENT stage their message indicates (pick the furthest-along one clearly implied; "" if none). ' +
    'note = one short sentence summarising what they said. ' +
    'factoryOrderNo / trackingNumber / carrier = extract if present, else "".';
  const o = await chatJSON(system, `Manufacturer reply:\n"""${reply.slice(0, 4000)}"""`);
  const key = str(o.stageKey);
  return {
    stageKey: PRODUCTION_STAGES.some((s) => s.key === key) ? key : '',
    note: str(o.note) || 'Update received.',
    factoryOrderNo: str(o.factoryOrderNo) || undefined,
    trackingNumber: str(o.trackingNumber) || undefined,
    carrier: str(o.carrier) || undefined,
  };
}
