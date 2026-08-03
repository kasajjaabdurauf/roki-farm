-- =====================================================================
-- Roki — Migration v4
-- Every self-signup is a FARMER (field agents use the access code).
-- Applies to new signups AND retro-fixes existing accounts that were
-- created as FIELD_AGENT without ever being used by staff.
-- =====================================================================

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
-- =====================================================================
