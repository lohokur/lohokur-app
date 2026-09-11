import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { draftOutreach } from '@/lib/liaison';
import { sendMail, mailConfigured } from '@/lib/mail';
import { sendWhatsApp, whatsappConfigured } from '@/lib/whatsapp';

export const runtime = 'nodejs';
export const maxDuration = 60;

type ChanResult = { status: 'sent' | 'queued' | 'skipped' | 'error'; detail?: string };

// The liaison agent reaches out to a manufacturer for an order — drafts the
// message (OpenAI) and sends it over email (Gmail) and/or WhatsApp (Twilio).
export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const manufacturerName = String(b.manufacturerName || '').slice(0, 120);
  const product = String(b.product || '').slice(0, 500);
  const mode = b.mode === 'bulk' ? 'bulk' : 'sample';
  const qty = Math.max(1, Math.min(100000, Number(b.qty) || 1));
  const email = String(b.email || '').trim();
  const whatsapp = String(b.whatsapp || '').trim();
  const channel = ['email', 'whatsapp', 'both'].includes(b.channel) ? b.channel : 'email';

  // gate to signed-in users — we're sending from our own inbox
  try {
    const sb = await supabaseServer();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: 'sign in required' }, { status: 401 });
  } catch { /* no DB (local) — allow */ }

  let draft;
  try {
    draft = await draftOutreach({ product, mode, qty, manufacturerName });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || 'could not draft message' }, { status: 502 });
  }

  const wantEmail = channel === 'email' || channel === 'both';
  const wantWhatsapp = channel === 'whatsapp' || channel === 'both';
  const emailRes: ChanResult = { status: 'skipped' };
  const waRes: ChanResult = { status: 'skipped' };

  if (wantEmail) {
    if (!email) { emailRes.status = 'skipped'; emailRes.detail = 'no manufacturer email'; }
    else if (!mailConfigured()) { emailRes.status = 'queued'; emailRes.detail = 'mail not configured'; }
    else {
      try { const id = await sendMail({ to: email, subject: draft.subject, text: draft.body }); emailRes.status = 'sent'; emailRes.detail = id; }
      catch (e) { emailRes.status = 'error'; emailRes.detail = (e as Error).message; }
    }
  }
  if (wantWhatsapp) {
    if (!whatsapp) { waRes.status = 'skipped'; waRes.detail = 'no manufacturer WhatsApp number'; }
    else if (!whatsappConfigured()) { waRes.status = 'queued'; waRes.detail = 'WhatsApp (Twilio) not configured'; }
    else {
      try { const id = await sendWhatsApp(whatsapp, draft.whatsapp); waRes.status = 'sent'; waRes.detail = id; }
      catch (e) { waRes.status = 'error'; waRes.detail = (e as Error).message; }
    }
  }

  return NextResponse.json({ draft, email: emailRes, whatsapp: waRes });
}
