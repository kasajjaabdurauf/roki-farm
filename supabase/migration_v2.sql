-- =====================================================================
-- Roki — Migration v2 (apply AFTER the original schema.sql)
-- Adds: profiles.email, first-user-becomes-admin, admin role management
-- (no more hand-editing SQL to add admins — do it from Settings → Team).
-- =====================================================================

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
-- =====================================================================
