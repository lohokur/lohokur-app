import { notFound } from 'next/navigation';
import Link from 'next/link';
import { supabaseServer } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { isAdmin } from '@/lib/admin';

export const dynamic = 'force-dynamic'; // always live, never cached

type Tier = 'free' | 'pro' | 'studio';
type Analytics = {
  users: { total: number; activated: number; rendered: number; paid: number };
  renders_this_month: number;
  by_tier: { tier: Tier; count: number }[];
  signups_14d: { day: string; count: number }[];
  recent: {
    email: string; tier: Tier; gens_used: number; nodes: number; projects: number;
    joined: string; last_active: string | null;
  }[];
};

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

export default async function AdminPage() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!isAdmin(user?.email)) notFound();

  const { data, error } = await supabaseAdmin().rpc('admin_analytics');
  if (error) {
    return (
      <main className="adm">
        <h1 className="adm-h1">Analytics</h1>
        <p className="adm-err">Couldn’t load analytics: {error.message}</p>
      </main>
    );
  }

  const a = data as Analytics;
  const { total, activated, rendered, paid } = a.users;
  const maxDay = Math.max(1, ...a.signups_14d.map((d) => d.count));

  const funnel = [
    { label: 'Signed up', value: total, sub: 'accounts', of: total },
    { label: 'Activated', value: activated, sub: 'placed a node', of: total },
    { label: 'Rendered', value: rendered, sub: 'this cycle', of: total },
    { label: 'Paid', value: paid, sub: 'Pro / Studio', of: total },
  ];

  return (
    <main className="adm">
      <header className="adm-top">
        <h1 className="adm-h1">Analytics</h1>
        <span style={{ display: 'flex', gap: 18 }}>
          <Link href="/admin/canvases" className="adm-canvas-link">Canvases →</Link>
          <Link href="/" className="adm-back">← Studio</Link>
        </span>
      </header>

      {/* funnel */}
      <section className="adm-funnel">
        {funnel.map((f, i) => (
          <div key={f.label} className="adm-stat">
            <span className="adm-stat-label">{f.label}</span>
            <span className="adm-stat-value">{f.value.toLocaleString()}</span>
            <span className="adm-stat-sub">
              {f.sub}{i > 0 && <> · <b>{pct(f.value, f.of)}%</b> of signups</>}
            </span>
          </div>
        ))}
      </section>

      <section className="adm-mini">
        <div><span>{a.renders_this_month.toLocaleString()}</span> renders this month</div>
        {a.by_tier.map((t) => (
          <div key={t.tier}><span>{t.count}</span> {t.tier}</div>
        ))}
      </section>

      {/* signups, last 14 days */}
      <section className="adm-block">
        <h2 className="adm-h2">Signups · last 14 days</h2>
        {a.signups_14d.length === 0 ? (
          <p className="adm-empty">No signups in the last 14 days.</p>
        ) : (
          <div className="adm-spark">
            {a.signups_14d.map((d) => (
              <div key={d.day} className="adm-bar" title={`${d.day}: ${d.count}`}>
                <div className="adm-bar-fill" style={{ height: `${Math.round((d.count / maxDay) * 100)}%` }} />
                <span className="adm-bar-n">{d.count}</span>
                <span className="adm-bar-d">{d.day.slice(5)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* recent users */}
      <section className="adm-block">
        <h2 className="adm-h2">Recent signups</h2>
        <div className="adm-tablewrap">
          <table className="adm-table">
            <thead>
              <tr><th>Email</th><th>Tier</th><th>Joined</th><th>Projects</th><th>Nodes</th><th>Gens</th><th>Last active</th></tr>
            </thead>
            <tbody>
              {a.recent.map((r) => (
                <tr key={r.email} className={r.nodes > 0 ? 'is-activated' : ''}>
                  <td>{r.email}</td>
                  <td><span className={`adm-tier adm-tier-${r.tier}`}>{r.tier}</span></td>
                  <td>{r.joined}</td>
                  <td>{r.projects}</td>
                  <td>{r.nodes}</td>
                  <td>{r.gens_used}</td>
                  <td>{r.last_active ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
