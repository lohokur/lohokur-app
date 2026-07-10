-- ============================================================================
-- 0001_billing.sql — subscription tiers + AI-generation metering
-- Run this in the Supabase SQL editor (Dashboard → SQL → New query → Run).
-- Safe to re-run: everything is idempotent (if-not-exists / create-or-replace).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user. Holds subscription state + monthly usage.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id                    uuid primary key references auth.users(id) on delete cascade,
  email                 text,
  tier                  text not null default 'free' check (tier in ('free','pro','studio')),
  stripe_customer_id    text unique,
  stripe_subscription_id text,
  subscription_status   text,                 -- active | trialing | past_due | canceled | ...
  current_period_end    timestamptz,          -- when the paid period ends (from Stripe)
  gens_used             int  not null default 0,
  usage_period          date not null default date_trunc('month', now())::date,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Users may read ONLY their own profile. There is deliberately no insert/update/
-- delete policy: the only writers are the service-role key (Stripe webhook) and the
-- SECURITY DEFINER functions below. This makes usage + tier untamperable from the client.
drop policy if exists "profiles self read" on public.profiles;
create policy "profiles self read" on public.profiles
  for select using (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- consume_generation: atomic check-and-increment of the monthly AI counter.
-- Called by the AI routes with the tier's cap (kept in code: lib/entitlements.ts).
-- Returns remaining generations after this one, or -1 if the cap is reached.
-- The single UPDATE takes a row lock, so N concurrent requests can't overspend.
-- ---------------------------------------------------------------------------
create or replace function public.consume_generation(p_cap int, p_cost int default 1)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  remaining int;
begin
  update public.profiles
     set gens_used = case
           when usage_period <> date_trunc('month', now())::date then p_cost  -- new month → reset
           else gens_used + p_cost end,
         usage_period = date_trunc('month', now())::date,
         updated_at = now()
   where id = auth.uid()
     and (usage_period <> date_trunc('month', now())::date or gens_used + p_cost <= p_cap)
  returning p_cap - gens_used into remaining;

  if not found then
    return -1;                    -- over the cap (or no profile row)
  end if;
  return remaining;
end;
$$;

-- refund_generation: give a credit back when the AI call itself fails, so users
-- are never charged for our errors.
create or replace function public.refund_generation(p_cost int default 1)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
     set gens_used = greatest(0, gens_used - p_cost), updated_at = now()
   where id = auth.uid()
     and usage_period = date_trunc('month', now())::date;
end;
$$;

grant execute on function public.consume_generation(int, int) to authenticated;
grant execute on function public.refund_generation(int)        to authenticated;

-- ---------------------------------------------------------------------------
-- Project-count cap. Projects are inserted directly from the browser (RLS), so
-- the cap is enforced with a BEFORE INSERT trigger — server-authoritative.
-- NOTE: keep these numbers in sync with `projects` in lib/entitlements.ts.
-- ---------------------------------------------------------------------------
create or replace function public.project_limit(p_tier text)
returns int language sql immutable as $$
  select case coalesce(p_tier,'free')
           when 'studio' then 2147483647   -- effectively unlimited
           when 'pro'    then 10
           else 1                           -- free
         end;
$$;

create or replace function public.enforce_project_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  t text; cnt int;
begin
  select tier into t from public.profiles where id = new.user_id;
  select count(*) into cnt from public.projects where user_id = new.user_id;
  if cnt >= public.project_limit(t) then
    raise exception 'project_limit_reached'
      using errcode = 'P0001', hint = 'upgrade';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_project_limit on public.projects;
create trigger trg_enforce_project_limit
  before insert on public.projects
  for each row execute function public.enforce_project_limit();

-- ---------------------------------------------------------------------------
-- Auto-create a profile row for every new (and existing) auth user.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for users that already exist.
insert into public.profiles (id, email)
select id, email from auth.users
on conflict (id) do nothing;
