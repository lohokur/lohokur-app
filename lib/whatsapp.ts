import 'server-only';

// WhatsApp send via Twilio. Real once TWILIO_* creds + a WhatsApp sender are set;
// until then whatsappConfigured() is false and the caller queues the message.
export const whatsappConfigured = () =>
  !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_FROM);

export async function sendWhatsApp(to: string, body: string): Promise<string> {
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const token = process.env.TWILIO_AUTH_TOKEN!;
  const from = process.env.TWILIO_WHATSAPP_FROM!;
  const wa = (n: string) => (n.startsWith('whatsapp:') ? n : `whatsapp:${n}`);
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
    },
    body: new URLSearchParams({ To: wa(to), From: wa(from), Body: body }),
  });
  if (!r.ok) throw new Error(`twilio ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return (await r.json()).sid as string;
}
