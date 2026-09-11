import 'server-only';
import nodemailer from 'nodemailer';

// Send email from the sourcing inbox (loho@lohokur.com) via Gmail OAuth2 — reused
// from the jobhunt setup. Used by the liaison agent to contact manufacturers.
export const mailConfigured = () =>
  !!(process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET && process.env.GMAIL_REFRESH_TOKEN);

const fromHeader = () => process.env.SOURCING_FROM || 'LOHO KUR <loho@lohokur.com>';
const account = () => (fromHeader().match(/<([^>]+)>/)?.[1] ?? 'loho@lohokur.com').trim();

export async function sendMail(opts: { to: string; subject: string; text: string; replyTo?: string }): Promise<string> {
  if (!mailConfigured()) throw new Error('mail not configured');
  const transport = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user: account(),
      clientId: process.env.GMAIL_CLIENT_ID,
      clientSecret: process.env.GMAIL_CLIENT_SECRET,
      refreshToken: process.env.GMAIL_REFRESH_TOKEN,
    },
  });
  const info = await transport.sendMail({
    from: fromHeader(),
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    replyTo: opts.replyTo ?? account(),
  });
  return info.messageId;
}
