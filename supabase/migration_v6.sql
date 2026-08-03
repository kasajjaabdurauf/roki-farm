-- =====================================================================
-- Roki — Migration v6  (upload ↔ account linking, part 2: the claim)
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
-- =====================================================================

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

-- =====================================================================
-- What this means in practice
--
-- Uploaded list with an email column + account signups use the SAME
-- email  → signup claims the list record (no duplicate farmer).
--
-- Uploaded list with NO email → the person's signup creates a new
-- record; an admin can still merge later by updating farmers.email.
-- =====================================================================
