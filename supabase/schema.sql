-- =====================================================================
-- Roki Fruit & Vegetables — Supabase schema (apply in Supabase SQL Editor)
-- Tables, row-level security and role plumbing.
-- Run once. After applying, create the admin account and assign roles.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- PROFILES — one row per auth user; carries role + optional linked farmer
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  role        text not null default 'FIELD_AGENT'
              check (role in ('ADMIN', 'FIELD_AGENT', 'FARMER')),
  farmer_id   text,               -- linked farmer id (for FARMER accounts)
  full_name   text,
  email       text,
  created_at  timestamptz not null default now()
);

-- auto-create a profile row on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name, email)
  values (
    new.id,
    case when not exists (select 1 from public.profiles) then 'ADMIN' else 'FIELD_AGENT' end,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- current user's role (falls back to FIELD_AGENT if missing)
create or replace function public.get_user_role()
returns text
language sql stable security definer set search_path = public
as $$
  select coalesce(
    (select role from public.profiles where id = auth.uid()),
    'FIELD_AGENT'
  );
$$;

-- ---------------------------------------------------------------------
-- FARMERS
-- ---------------------------------------------------------------------
create table if not exists public.farmers (
  id                   text primary key,          -- RFV-UG-XXXXX
  full_name            text not null,
  phone                text,
  nin                  text,
  district             text,
  sub_county           text,
  village              text,
  acreage              numeric not null default 0,
  primary_crops        jsonb not null default '[]',
  irrigation_type      text not null default 'NONE',
  scale_tier           text not null default 'MICRO',
  roki_tier            integer not null default 3,
  gender               text not null default 'M',
  refugee_status       text not null default 'NONE',
  age_group            text not null default '36-45',
  land_ownership       text not null default 'OWN',
  household_size       integer,
  planned_productions  jsonb not null default '[]',
  survey               jsonb,                      -- full 15-section questionnaire
  flags                jsonb not null default '[]',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- PRODUCE LOGS
-- ---------------------------------------------------------------------
create table if not exists public.produce_logs (
  id               text primary key,               -- RFV-LOG-XXXXX
  farmer_id        text not null references public.farmers (id) on delete cascade,
  crop_type        text not null,
  quantity_kg      numeric not null default 0,
  quality_grade    text not null default 'A',
  harvest_date     date,
  batch_id         text,
  storage_location text,
  status           text not null default 'VERIFIED',
  audit_notes      jsonb not null default '[]',
  yield_score      text not null default 'EXPECTED',
  source           text not null default 'FIELD_AGENT',
  created_at       timestamptz not null default now()
);

create index if not exists produce_logs_farmer_idx on public.produce_logs (farmer_id);
create index if not exists produce_logs_crop_idx on public.produce_logs (crop_type);

-- ---------------------------------------------------------------------
-- SETTINGS (single row, id = 1)
-- ---------------------------------------------------------------------
create table if not exists public.settings (
  id         integer primary key default 1 check (id = 1),
  rules      jsonb not null default '{}',
  crops      jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

-- =====================================================================
-- ROW-LEVEL SECURITY
-- =====================================================================
alter table public.profiles        enable row level security;
alter table public.farmers         enable row level security;
alter table public.produce_logs    enable row level security;
alter table public.settings        enable row level security;

-- ---------- PROFILES ----------
drop policy if exists "profiles select own or admin" on public.profiles;
create policy "profiles select own or admin" on public.profiles
  for select using (id = auth.uid() or public.get_user_role() = 'ADMIN');

drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles
  for update using (id = auth.uid());

drop policy if exists "profiles update as admin" on public.profiles;
create policy "profiles update as admin" on public.profiles
  for update using (public.get_user_role() = 'ADMIN');

drop policy if exists "profiles insert as admin" on public.profiles;
create policy "profiles insert as admin" on public.profiles
  for insert with check (public.get_user_role() = 'ADMIN');

-- ---------- FARMERS ----------
-- read: admins + field agents see all; farmers see only their own row
drop policy if exists "farmers select" on public.farmers;
create policy "farmers select" on public.farmers
  for select using (
    public.get_user_role() in ('ADMIN', 'FIELD_AGENT')
    or id = (select farmer_id from public.profiles where id = auth.uid())
  );

-- insert: admins + field agents (registration happens in the field)
drop policy if exists "farmers insert" on public.farmers;
create policy "farmers insert" on public.farmers
  for insert with check (public.get_user_role() in ('ADMIN', 'FIELD_AGENT'));

-- update: admins only (data integrity); agents use insert + support ticket
drop policy if exists "farmers update" on public.farmers;
create policy "farmers update" on public.farmers
  for update using (public.get_user_role() = 'ADMIN');

-- delete: admins only
drop policy if exists "farmers delete" on public.farmers;
create policy "farmers delete" on public.farmers
  for delete using (public.get_user_role() = 'ADMIN');

-- ---------- PRODUCE LOGS ----------
-- read: admins + agents all; farmers own logs only
drop policy if exists "logs select" on public.produce_logs;
create policy "logs select" on public.produce_logs
  for select using (
    public.get_user_role() in ('ADMIN', 'FIELD_AGENT')
    or farmer_id = (select farmer_id from public.profiles where id = auth.uid())
  );

-- insert: any authenticated user; farmers may only log their own farmer_id
drop policy if exists "logs insert" on public.produce_logs;
create policy "logs insert" on public.produce_logs
  for insert with check (
    public.get_user_role() in ('ADMIN', 'FIELD_AGENT')
    or farmer_id = (select farmer_id from public.profiles where id = auth.uid())
  );

-- update: admins + agents (fixing typos), farmers own logs
drop policy if exists "logs update" on public.produce_logs;
create policy "logs update" on public.produce_logs
  for update using (
    public.get_user_role() in ('ADMIN', 'FIELD_AGENT')
    or farmer_id = (select farmer_id from public.profiles where id = auth.uid())
  );

-- delete: admins + agents
drop policy if exists "logs delete" on public.produce_logs;
create policy "logs delete" on public.produce_logs
  for delete using (public.get_user_role() in ('ADMIN', 'FIELD_AGENT'));

-- ---------- SETTINGS ----------
drop policy if exists "settings select" on public.settings;
create policy "settings select" on public.settings
  for select using (auth.role() = 'authenticated');

drop policy if exists "settings update" on public.settings;
create policy "settings update" on public.settings
  for update using (public.get_user_role() = 'ADMIN');

-- =====================================================================
-- SEED SETTINGS (run once)
-- =====================================================================
insert into public.settings (id, rules, crops)
values (1, '{"anomalyDetection":true,"duplicateGuard":true,"incompleteProfile":true,"yieldScoring":true}', '{}')
on conflict (id) do nothing;

-- =====================================================================
-- HOW TO ASSIGN ROLES (run once, as the admin, after creating accounts)
--   update public.profiles set role = 'ADMIN' where id = '<admin auth uid>';
--   update public.profiles set role = 'FARMER', farmer_id = 'RFV-UG-00001'
--     where id = '<farmer auth uid>';
-- =====================================================================
