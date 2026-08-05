-- =====================================================================
-- Roki — Migration v12  (TWO-GROUP MODEL: Admin + Agent)
-- Farmers don't use the app (agents onboard them). So:
--  1) New signups default to FIELD_AGENT (not FARMER).
--  2) Existing FARMER-role accounts become FIELD_AGENT.
--  3) The farmer-record auto-create on signup stays (agent-registered
--     farmers + signups still get records), but the account role is
--     always an agent until an admin promotes it.
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
  -- Two-group model: the first account becomes ADMIN, everyone else is
  -- an agent until an existing admin promotes them.
  v_role := case when not exists (select 1 from public.profiles) then 'ADMIN' else 'FIELD_AGENT' end;

  if v_role = 'FIELD_AGENT' then
    select id into v_farmer_id
    from public.farmers
    where lower(coalesce(email, '')) = lower(coalesce(new.email, ''))
    limit 1;

    if v_farmer_id is null then
      v_farmer_id := 'RFV-UG-' || lpad(nextval('public.farmers_id_seq')::text, 5, '0');
      insert into public.farmers (id, full_name, email, created_at, updated_at)
      values (v_farmer_id, v_name, new.email, now(), now());
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

-- Existing FARMER-role accounts become agents (they don't use a farmer
-- dashboard anymore; agents onboard farmers).
update public.profiles
set role = 'FIELD_AGENT'
where role = 'FARMER';

-- =====================================================================
-- DONE. The app now has two groups: Admin and Agent.
-- =====================================================================
