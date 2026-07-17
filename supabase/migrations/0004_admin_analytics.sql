-- ============================================================================
-- 0004_admin_analytics.sql — funnel metrics for the /admin dashboard.
-- One SECURITY DEFINER function that aggregates the signup → activated →
-- rendered → paid funnel from profiles + projects. Callable only by the
-- service-role (the Next.js /admin page calls it after checking the caller is
-- an admin), never by normal authenticated users.
-- Run in the Supabase SQL editor. Idempotent.
-- ============================================================================

create or replace function public.admin_analytics()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  with proj as (
    select user_id,
           count(*)::int as projects,
           coalesce(sum(jsonb_array_length(coalesce(flow->'nodes', '[]'::jsonb))), 0)::int as nodes,
           max(updated_at) as last_active
    from public.projects
    group by user_id
  ),
  u as (
    select p.id, p.email, p.tier, p.gens_used, p.created_at,
           coalesce(pr.projects, 0) as projects,
           coalesce(pr.nodes, 0) as nodes,
           pr.last_active
    from public.profiles p
    left join proj pr on pr.user_id = p.id
  )
  select jsonb_build_object(
    'users', jsonb_build_object(
      'total',     (select count(*) from u),
      'activated', (select count(*) from u where nodes > 0),
      'rendered',  (select count(*) from u where gens_used > 0),
      'paid',      (select count(*) from u where tier <> 'free')
    ),
    'renders_this_month', (select coalesce(sum(gens_used), 0) from u),
    'by_tier', (
      select coalesce(jsonb_agg(jsonb_build_object('tier', tier, 'count', c) order by c desc), '[]'::jsonb)
      from (select tier, count(*)::int c from u group by tier) z
    ),
    'signups_14d', (
      select coalesce(jsonb_agg(jsonb_build_object('day', day, 'count', c) order by day), '[]'::jsonb)
      from (
        select to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as day, count(*)::int c
        from u where created_at > now() - interval '14 days'
        group by 1
      ) z
    ),
    'recent', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'email', email, 'tier', tier, 'gens_used', gens_used,
               'nodes', nodes, 'projects', projects,
               'joined', to_char(created_at, 'YYYY-MM-DD'),
               'last_active', to_char(last_active, 'YYYY-MM-DD')
             ) order by created_at desc), '[]'::jsonb)
      from (select * from u order by created_at desc limit 30) z
    )
  );
$$;

revoke execute on function public.admin_analytics() from public, authenticated;
grant  execute on function public.admin_analytics() to service_role;
