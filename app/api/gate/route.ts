import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const origin = new URL(req.url).origin;
  const form = await req.formData().catch(() => null);
  const password = String(form?.get('password') ?? '');

  const expected = process.env.GATE_PASSWORD;
  const token = process.env.GATE_TOKEN;

  if (!expected || !token || password !== expected) {
    return NextResponse.redirect(`${origin}/login?e=1`, { status: 303 });
  }

  const res = NextResponse.redirect(`${origin}/`, { status: 303 });
  res.cookies.set('lk_gate', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return res;
}
