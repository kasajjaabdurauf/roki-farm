-- =====================================================================
-- Roki — Migration v3 (apply AFTER schema.sql and migration_v2.sql)
--
-- New signup flow: people choose "Field agent" or "Farmer" at signup,
-- and the trigger stores that choice. ADMIN can NEVER be self-selected
-- (the first account on a fresh database still becomes Admin).
-- =====================================================================

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
-- =====================================================================
