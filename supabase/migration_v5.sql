-- =====================================================================
-- Roki — Migration v5  (THE BIG ONE: accounts ARE farmers)
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
-- =====================================================================

-- 1) email column on farmers (so farmers are searchable by email)
alter table public.farmers add column if not exists email text;

-- 2) id sequence for farmer ids
create sequence if not exists public.farmers_id_seq;

-- 3) start the sequence past any existing ids
select setval(
  'public.farmers_id_seq',
  coalesce(max((regexp_replace(id, '^RFV-UG-', ''))::int), 0)
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

-- =====================================================================
-- DONE. From here on:
--   sign up → own RFV-UG id + farmer record appear immediately
--   complete survey → fills in THEIR record (no linking anywhere)
-- =====================================================================
