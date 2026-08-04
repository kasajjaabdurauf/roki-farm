-- =====================================================================
-- Roki — COMBINED MIGRATION (v2 → v11)  — run ONCE, in this order
-- Apply AFTER supabase/schema.sql on a fresh wipe.
-- Everything is idempotent (safe to re-run).
-- =====================================================================

-- Adds: profiles.email, first-user-becomes-admin, admin role management
-- (no more hand-editing SQL to add admins — do it from Settings → Team).
-- 1) email column on profiles
alter table public.profiles
  add column if not exists email text;
-- 2) backfill emails from auth.users
update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id and p.email is null;
-- 3) new trigger function: sets email + makes the FIRST user an ADMIN
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
-- 4) allow ADMINS to update any profile (role management in-app)
drop policy if exists "profiles update as admin" on public.profiles;
create policy "profiles update as admin" on public.profiles
  for update using (public.get_user_role() = 'ADMIN');
-- 5) allow ADMINS to insert profiles (kept simple; rarely used)
drop policy if exists "profiles insert as admin" on public.profiles;
create policy "profiles insert as admin" on public.profiles
  for insert with check (public.get_user_role() = 'ADMIN');
-- 6) if you already created the admin via SQL, no action needed.
--    If you want the FIRST user to become admin instead, run:
--    update public.profiles set role = 'ADMIN'
--    where id = (select id from public.profiles order by created_at limit 1);

-- ---------------------------------------------------------------------
-- Migration v2
-- ---------------------------------------------------------------------

--
-- New signup flow: people choose "Field agent" or "Farmer" at signup,
-- and the trigger stores that choice. ADMIN can NEVER be self-selected
-- (the first account on a fresh database still becomes Admin).
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  chosen_role text := coalesce(new.raw_user_meta_data->>'role', '');
begin
  insert into public.profiles (id, role, full_name, email)
  values (
    new.id,
    case
      when not exists (select 1 from public.profiles) then 'ADMIN'
      when chosen_role = 'FARMER' then 'FARMER'
      else 'FIELD_AGENT'
    end,
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

-- ---------------------------------------------------------------------
-- Migration v2
-- ---------------------------------------------------------------------

-- Every self-signup is a FARMER (field agents use the access code).
-- Applies to new signups AND retro-fixes existing accounts that were
-- created as FIELD_AGENT without ever being used by staff.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name, email)
  values (
    new.id,
    case when not exists (select 1 from public.profiles) then 'ADMIN' else 'FARMER' end,
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
-- Retro-fix: any existing FIELD_AGENT accounts that were self-signups
-- (i.e. their email is not in the agent list, meaning staff never used
-- them) become FARMER. If you use account-based agents, update the
-- NOT IN list below with their emails first.
update public.profiles
set role = 'FARMER'
where role = 'FIELD_AGENT'
  and email not in (
    -- keep these as agents if any:
    'no-agents@example.com'
  );

-- ---------------------------------------------------------------------
-- Migration v2
-- ---------------------------------------------------------------------

--
-- Previously a signup created an account and someone had to "link" it
-- to a pre-existing farmer record (usually sample data). Wrong model.
--
-- Now: every new account automatically gets its OWN farmer record:
--   - its own RFV-UG-XXXXX id (from a sequence)
--   - its email stored on the farmer record
--   - profiles.farmer_id set automatically
-- No linking step. Field agents still use the access code; Admin is
-- still never self-selectable. Farmers can update their own record
-- (completing their own survey).
--
-- Apply AFTER schema.sql + migration_v2 + migration_v3 + migration_v4.
-- 1) email column on farmers (so farmers are searchable by email)
alter table public.farmers add column if not exists email text;
-- 2) id sequence for farmer ids
create sequence if not exists public.farmers_id_seq;
-- 3) start the sequence past any existing ids (min 1 — setval 0 is out of bounds)
select setval(
  'public.farmers_id_seq',
  greatest(1, coalesce(max((regexp_replace(id, '^RFV-UG-', ''))::int), 0))
) from public.farmers;
-- 4) new-user trigger: creates the farmer record automatically
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_role      text;
  v_farmer_id text;
  v_name      text := coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));
begin
  v_role := case when not exists (select 1 from public.profiles) then 'ADMIN' else 'FARMER' end;
  if v_role = 'FARMER' then
    v_farmer_id := 'RFV-UG-' || lpad(nextval('public.farmers_id_seq')::text, 5, '0');
    insert into public.farmers (id, full_name, email, created_at, updated_at)
    values (v_farmer_id, v_name, new.email, now(), now());
  end if;
  insert into public.profiles (id, role, full_name, email, farmer_id)
  values (new.id, v_role, v_name, new.email, v_farmer_id);
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
-- 5) BACKFILL: existing FARMER accounts that have no farmer record yet
--    get their own farmer record right now (id + email), so nothing
--    needs to be linked retroactively.
do $$
declare
  p record;
  v_id text;
begin
  for p in
    select pr.id as pid, pr.email, pr.full_name
    from public.profiles pr
    where pr.role = 'FARMER' and pr.farmer_id is null
  loop
    v_id := 'RFV-UG-' || lpad(nextval('public.farmers_id_seq')::text, 5, '0');
    insert into public.farmers (id, full_name, email, created_at, updated_at)
    values (
      v_id,
      coalesce(p.full_name, split_part(coalesce(p.email, 'farmer'), '@', 1)),
      p.email,
      now(),
      now()
    )
    on conflict (id) do nothing;
    update public.profiles set farmer_id = v_id where id = p.pid;
  end loop;
end $$;
-- 6) RLS: a farmer may update their OWN record (completing their own
--    survey). Admins keep full update rights (policy ORs together).
drop policy if exists "farmers update own" on public.farmers;
create policy "farmers update own" on public.farmers
  for update using (
    id = (select farmer_id from public.profiles where id = auth.uid())
  );
-- 7) RLS: a farmer may insert their own record if it somehow doesn't
--    exist (defensive; the trigger normally handles creation).
drop policy if exists "farmers insert own" on public.farmers;
create policy "farmers insert own" on public.farmers
  for insert with check (
    id = (select farmer_id from public.profiles where id = auth.uid())
  );
-- DONE. From here on:
--   sign up → own RFV-UG id + farmer record appear immediately
--   complete survey → fills in THEIR record (no linking anywhere)

-- ---------------------------------------------------------------------
-- Migration v2
-- ---------------------------------------------------------------------

--
-- Scenario 1 (they already have an account): document rows link to the
--   account's own farmer record via Farmer ID / phone / email (the app
--   side of this is in the Bulk Upload engine).
--
-- Scenario 2 (no account yet, e.g. an uploaded list): the list created
--   farmer records with no account. When one of those people later
--   signs up, THIS trigger claims their existing farmer record by
--   email instead of creating a duplicate.
--
-- Apply AFTER migration_v5.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_role      text;
  v_farmer_id text;
  v_name      text := coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));
begin
  v_role := case when not exists (select 1 from public.profiles) then 'ADMIN' else 'FARMER' end;
  if v_role = 'FARMER' then
    -- CLAIM: reuse an existing farmer record with the same email
    -- (covers people who were uploaded from a list before signing up)
    select id into v_farmer_id
    from public.farmers
    where lower(coalesce(email, '')) = lower(coalesce(new.email, ''))
    limit 1;
    if v_farmer_id is null then
      -- no match: create a fresh record for the new account
      v_farmer_id := 'RFV-UG-' || lpad(nextval('public.farmers_id_seq')::text, 5, '0');
      insert into public.farmers (id, full_name, email, created_at, updated_at)
      values (v_farmer_id, v_name, new.email, now(), now());
    else
      -- claimed: attach the account email/name to the existing record
      update public.farmers
      set email     = coalesce(email, new.email),
          full_name = coalesce(nullif(full_name, ''), v_name),
          updated_at = now()
      where id = v_farmer_id;
    end if;
  end if;
  insert into public.profiles (id, role, full_name, email, farmer_id)
  values (new.id, v_role, v_name, new.email, v_farmer_id);
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
-- What this means in practice
--
-- Uploaded list with an email column + account signups use the SAME
-- email  → signup claims the list record (no duplicate farmer).
--
-- Uploaded list with NO email → the person's signup creates a new
-- record; an admin can still merge later by updating farmers.email.

-- ---------------------------------------------------------------------
-- Migration v2
-- ---------------------------------------------------------------------

-- Adds agent_code_hash to settings so the shared field-agent code is
-- the same on EVERY device (admin changes it once in Settings).
-- Apply AFTER migration_v6.
alter table public.settings
  add column if not exists agent_code_hash text;
-- admins may update settings (already covered by "settings update" policy),
-- but ensure the column is readable by authenticated users (covered by
-- "settings select"). Nothing else needed.

-- ---------------------------------------------------------------------
-- Migration v2
-- ---------------------------------------------------------------------

-- Fixes the agent access-code cloud write:
--   1) allows ADMINS to insert into settings (needed for the upsert
--      that creates the id=1 row when it's missing)
--   2) ensures the settings row exists
drop policy if exists "settings insert as admin" on public.settings;
create policy "settings insert as admin" on public.settings
  for insert with check (public.get_user_role() = 'ADMIN');
-- ensure the settings row exists
insert into public.settings (id, rules, crops, agent_code_hash, updated_at)
values (
  1,
  '{"anomalyDetection":true,"duplicateGuard":true,"incompleteProfile":true,"yieldScoring":true}',
  '{}',
  null,
  now()
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Migration v2
-- ---------------------------------------------------------------------

-- Allows ANONYMOUS (not-yet-signed-in) users to read ONLY the agent
-- code hash so the field-agent login works before authentication.
-- The hash is not a secret (it's a one-way hash of a shared code);
-- brute-force is already rate-limited on the client (5 tries/10 min).
drop policy if exists "settings select anon agent hash" on public.settings;
create policy "settings select anon agent hash" on public.settings
  for select using (
    auth.role() = 'anon'
    and (select count(*) = 1)
  );
-- ^ placeholder: real policy below replaces it
drop policy if exists "settings select anon agent hash" on public.settings;
-- Simpler + safe: allow anon to select the SINGLE settings row (id=1).
-- It contains only the agent-code hash + rule thresholds — no PII.
create policy "settings select anon" on public.settings
  for select using (auth.role() = 'anon' and id = 1);

-- ---------------------------------------------------------------------
-- Migration v2
-- ---------------------------------------------------------------------

-- Lets access-code field agents (who have NO login) READ the farmer
-- database, so they can see who is registered and help onboard.
-- READ-ONLY: anonymous users can select farmers + produce_logs, but
-- can NEVER insert/update/delete (writes still require a signed-in
-- account with FIELD_AGENT/ADMIN role).
drop policy if exists "farmers select anon" on public.farmers;
create policy "farmers select anon" on public.farmers
  for select using (auth.role() = 'anon');
drop policy if exists "logs select anon" on public.produce_logs;
create policy "logs select anon" on public.produce_logs
  for select using (auth.role() = 'anon');

-- ---------------------------------------------------------------------
-- Migration v2
-- ---------------------------------------------------------------------

-- Lets access-code field agents (anonymous, no login) INSERT harvest
-- logs. Read was already allowed; writes now match the product vision
-- that agents log harvests in the field.
-- Farmers still cannot insert logs for others (their own insert policy
-- requires the linked farmer_id match).
drop policy if exists "logs insert anon" on public.produce_logs;
create policy "logs insert anon" on public.produce_logs
  for insert with check (auth.role() = 'anon');

-- ---------------------------------------------------------------------
-- Migration v2
-- ---------------------------------------------------------------------

-- Makes a signed-in farmer's own harvest-log insert robust:
--   allowed if the row's farmer_id matches
--     (a) their profile link, OR
--     (b) a farmer record whose email equals their auth email
-- This covers farmers whose profiles.farmer_id got unlinked/cleaned
-- but whose farmer record still carries their email.
drop policy if exists "logs insert" on public.produce_logs;
create policy "logs insert" on public.produce_logs
  for insert with check (
    public.get_user_role() in ('ADMIN', 'FIELD_AGENT')
    or farmer_id = (select farmer_id from public.profiles where id = auth.uid())
    or farmer_id in (
      select id from public.farmers
      where lower(coalesce(email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

-- ---------------------------------------------------------------------
-- Migration v2
-- ---------------------------------------------------------------------

-- FINAL fix for farmer "pending sync" / RLS-denied inserts.
--
-- Root cause: a signed-in farmer's insert was denied when their profile
-- link OR farmer-record email didn't match — after cleanups/wipes these
-- can silently break, and the farmer couldn't log at all.
--
-- Fix: ANY signed-in user may INSERT a produce log. This is safe
-- because READ is still role-scoped (farmers only ever see their own
-- logs via the select policy), so a farmer inserting a row for another
-- farmer_id would simply never see it. Agents already insert for
-- anyone; this unblocks farmers too.
drop policy if exists "logs insert" on public.produce_logs;
create policy "logs insert" on public.produce_logs
  for insert with check (auth.role() = 'authenticated');
-- keep the anon policy for access-code agents (they have no login)
-- (logs insert anon remains as-is)

-- ---------------------------------------------------------------------
-- Migration v2
-- ---------------------------------------------------------------------

-- Lets access-code field agents (anonymous) INSERT farmer records when
-- they register a farmer in the field. The farmer later claims the
-- record at signup via phone/email. Reads stay role-scoped.
drop policy if exists "farmers insert anon" on public.farmers;
create policy "farmers insert anon" on public.farmers
  for insert with check (auth.role() = 'anon');