import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { isAdmin } from '@/lib/admin';

export const dynamic = 'force-dynamic'; // always live, never cached

export default async function AdminLogins() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!isAdmin(user?.email)) notFound();

  const { data: userList } = await supabaseAdmin().auth.admin.listUsers({ perPage: 1000 });
  const users = userList?.users ?? [];

  type Row = { email: string; logins: number; lastLogin: string | null; joined: string | null };
  const rows: Row[] = users.map((u) => {
    const md = (u.user_metadata ?? {}) as Record<string, unknown>;
    const logins = typeof md.login_count === 'number' ? md.login_count : 0;
    const lastLogin = (typeof md.last_login_at === 'string' ? md.last_login_at : null) ?? u.last_sign_in_at ?? null;
    return { email: u.email ?? '—', logins, lastLogin, joined: u.created_at ?? null };
  });
  // most active first; unseen (0) sink to the bottom, then by recency
  rows.sort((a, b) => b.logins - a.logins || (b.lastLogin ?? '').localeCompare(a.lastLogin ?? ''));

  const totalLogins = rows.reduce((n, r) => n + r.logins, 0);
  const counted = rows.filter((r) => r.logins > 0).length;

  const fmt = (s: string | null) => (s ? new Date(s).toISOString().slice(0, 16).replace('T', ' ') : '—');

  return (
    <main className="adm">
      <div className="adm-head">
        <h1 className="adm-h1">Logins</h1>
        <span style={{ display: 'flex', gap: 18 }}>
          <Link href="/admin/canvases" className="ghost-link">Canvases →</Link>
          <Link href="/admin" className="ghost-link">← Analytics</Link>
        </span>
      </div>
      <p className="adm-sub">
        {totalLogins.toLocaleString()} sign-ins tracked across {counted} of {rows.length} accounts.
        Counting started when this was shipped — historical logins aren’t included.
      </p>

      <div className="adm-table">
        <div className="adm-tr adm-th" style={{ gridTemplateColumns: '2fr 1fr 1.4fr 1.4fr' }}>
          <span>Account</span><span>Logins</span><span>Last login</span><span>Joined</span>
        </div>
        {rows.map((r) => (
          <div className="adm-tr" key={r.email} style={{ gridTemplateColumns: '2fr 1fr 1.4fr 1.4fr' }}>
            <span className="adm-email">{r.email}</span>
            <span className="adm-num">{r.logins}</span>
            <span className="adm-num">{fmt(r.lastLogin)}</span>
            <span className="adm-num">{fmt(r.joined)}</span>
          </div>
        ))}
      </div>
    </main>
  );
}
