import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { isAdmin } from '@/lib/admin';

export const dynamic = 'force-dynamic'; // always live, never cached

type Row = { id: string; name: string; user_id: string | null; updated_at: string | null; flow: { nodes?: unknown[] } | null };

export default async function AdminCanvases() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!isAdmin(user?.email)) notFound();

  const admin = supabaseAdmin();
  const [{ data: projects }, { data: userList }] = await Promise.all([
    admin.from('projects').select('id, name, user_id, updated_at, flow').order('updated_at', { ascending: false }),
    admin.auth.admin.listUsers({ perPage: 1000 }),
  ]);

  const emailBy: Record<string, string> = {};
  for (const u of userList?.users ?? []) emailBy[u.id] = u.email ?? '—';

  const rows = (projects as Row[] | null) ?? [];
  const fmt = (s: string | null) => (s ? new Date(s).toISOString().slice(0, 10) : '—');
  const nodeCount = (r: Row) => (Array.isArray(r.flow?.nodes) ? r.flow!.nodes!.length : 0);

  return (
    <main className="adm">
      <div className="adm-head">
        <h1 className="adm-h1">Canvases</h1>
        <Link href="/admin" className="ghost-link">← Analytics</Link>
      </div>
      <p className="adm-sub">{rows.length} project{rows.length === 1 ? '' : 's'} across all accounts. Open any to view read-only.</p>

      <div className="adm-table">
        <div className="adm-tr adm-th">
          <span>Owner</span><span>Project</span><span>Nodes</span><span>Updated</span><span></span>
        </div>
        {rows.map((r) => (
          <div className="adm-tr" key={r.id}>
            <span className="adm-email">{r.user_id ? (emailBy[r.user_id] ?? '—') : '—'}</span>
            <span>{r.name || 'Untitled'}</span>
            <span className="adm-num">{nodeCount(r)}</span>
            <span className="adm-num">{fmt(r.updated_at)}</span>
            <span><Link className="adm-open" href={`/studio/${r.id}`}>Open →</Link></span>
          </div>
        ))}
      </div>
    </main>
  );
}
