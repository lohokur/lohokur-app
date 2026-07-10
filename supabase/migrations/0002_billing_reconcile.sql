-- ============================================================================
-- 0002_billing_reconcile.sql — extend the EXISTING profiles table (token-based)
-- with Stripe subscription state + monthly AI-generation metering.
-- Additive & idempotent: keeps all existing rows and the legacy `tokens` column.
-- Run in the Supabase SQL editor.
-- ============================================================================

-- 1. Add the columns our Stripe/metering code needs (existing rows get defaults).
alter table public.profiles
  add column if not exists stripe_customer_id     text,
  add column if not exists stripe_subscription_id text,
  add column if not exists subscription_status    text,
  add column if not exists current_period_end     timestamptz,
  add column if not exists gens_used              int  not null default 0,
  add column if not exists usage_period           date not null default date_trunc('month', now())::date,
  add column if not exists updated_at             timestamptz not null default now();

-- constrain tier to our three plans (skip if already present)
do $do$ begin
  alter table public.profiles add constraint profiles_tier_chk check (tier in ('free','pro','studio'));
exception when duplicate_object then null; end $do$;

create unique index if not exists profiles_stripe_customer_id_key on public.profiles (stripe_customer_id);

-- 2. Lock down RLS: users may READ their own row but NOT write it. tier + gens_used
--    are set only by the server (webhook / SECURITY DEFINER functions). This closes
--    the hole where the old "own profile update" policy let a user set their own tier.
drop policy if exists "own profile update" on public.profiles;
drop policy if exists "own profile read"   on public.profiles;
drop policy if exists "profiles self read" on public.profiles;
create policy "profiles self read" on public.profiles for select using (auth.uid() = id);

-- 3. Atomic monthly generation metering (cap passed from lib/entitlements.ts).
create or replace function public.consume_generation(p_cap int, p_cost int default 1)
returns int language plpgsql security definer set search_path = public as $fn$
declare remaining int;
begin
  update public.profiles
     set gens_used = case when usage_period <> date_trunc('month', now())::date then p_cost
                          else gens_used + p_cost end,
         usage_period = date_trunc('month', now())::date,
         updated_at = now()
   where id = auth.uid()
     and (usage_period <> date_trunc('month', now())::date or gens_used + p_cost <= p_cap)
  returning p_cap - gens_used into remaining;
  if not found then return -1; end if;
  return remaining;
end; $fn$;

create or replace function public.refund_generation(p_cost int default 1)
returns void language plpgsql security definer set search_path = public as $fn$
begin
  update public.profiles set gens_used = greatest(0, gens_used - p_cost), updated_at = now()
   where id = auth.uid() and usage_period = date_trunc('month', now())::date;
end; $fn$;

grant execute on function public.consume_generation(int, int) to authenticated;
grant execute on function public.refund_generation(int)        to authenticated;

-- 4. Project-count cap (keep numbers in sync with lib/entitlements.ts).
create or replace function public.project_limit(p_tier text)
returns int language sql immutable as $fn$
  select case coalesce(p_tier,'free') when 'studio' then 2147483647 when 'pro' then 10 else 1 end;
$fn$;

create or replace function public.enforce_project_limit()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare t text; cnt int;
begin
  select tier into t from public.profiles where id = new.user_id;
  select count(*) into cnt from public.projects where user_id = new.user_id;
  if cnt >= public.project_limit(t) then
    raise exception 'project_limit_reached' using errcode = 'P0001', hint = 'upgrade';
  end if;
  return new;
end; $fn$;

drop trigger if exists trg_enforce_project_limit on public.projects;
create trigger trg_enforce_project_limit before insert on public.projects
  for each row execute function public.enforce_project_limit();

-- 5. Ensure every auth user has a profile row.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  insert into public.profiles (id, email) values (new.id, new.email) on conflict (id) do nothing;
  return new;
end; $fn$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

insert into public.profiles (id, email) select id, email from auth.users on conflict (id) do nothing;

-- 6. Grant the owner Studio (unlimited).
update public.profiles set tier = 'studio' where email = 'lohokur123@gmail.com';
