-- VikingStrong: invite codes + admin teacher editing
-- Run this once in the Supabase SQL editor (Project → SQL → New query → Run).
-- Safe to run more than once.

-- ── Invite code storage ──────────────────────
create table if not exists public.app_settings (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

-- No direct table access. Everything goes through the functions below.
revoke all on public.app_settings from anon, authenticated;
grant select, insert, update on public.app_settings to postgres, service_role;

insert into public.app_settings (key, value)
values ('invite_code', 'VIKING-' || upper(substr(md5(random()::text), 1, 6)))
on conflict (key) do nothing;

create or replace function public.verify_invite_code(p_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare stored text;
begin
  select value into stored from public.app_settings where key = 'invite_code';
  if stored is null or btrim(stored) = '' then
    return false;
  end if;
  return lower(btrim(stored)) = lower(btrim(coalesce(p_code, '')));
end;
$$;

create or replace function public.get_invite_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare stored text;
begin
  if coalesce(auth.jwt() ->> 'email', '') is distinct from 'chuynh@lasdschools.org' then
    raise exception 'not authorized';
  end if;
  select value into stored from public.app_settings where key = 'invite_code';
  return coalesce(stored, '');
end;
$$;

create or replace function public.set_invite_code(p_code text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare cleaned text;
begin
  if coalesce(auth.jwt() ->> 'email', '') is distinct from 'chuynh@lasdschools.org' then
    raise exception 'not authorized';
  end if;
  cleaned := btrim(coalesce(p_code, ''));
  if length(cleaned) < 4 then
    raise exception 'invite code must be at least 4 characters';
  end if;
  insert into public.app_settings (key, value, updated_at)
  values ('invite_code', cleaned, now())
  on conflict (key) do update
    set value = excluded.value,
        updated_at = now();
  return cleaned;
end;
$$;

revoke all on function public.verify_invite_code(text) from public;
revoke all on function public.get_invite_code() from public;
revoke all on function public.set_invite_code(text) from public;
grant execute on function public.verify_invite_code(text) to anon, authenticated;
grant execute on function public.get_invite_code() to authenticated;
grant execute on function public.set_invite_code(text) to authenticated;

-- ── Admin can see and edit every teacher ───────────
drop policy if exists "admin_select_teachers" on public.teachers;
create policy "admin_select_teachers" on public.teachers
  for select
  using (coalesce(auth.jwt() ->> 'email', '') = 'chuynh@lasdschools.org');

drop policy if exists "admin_update_teachers" on public.teachers;
create policy "admin_update_teachers" on public.teachers
  for update
  using (coalesce(auth.jwt() ->> 'email', '') = 'chuynh@lasdschools.org')
  with check (coalesce(auth.jwt() ->> 'email', '') = 'chuynh@lasdschools.org');

-- ── Create a teachers row whenever someone registers ─────
create or replace function public.handle_new_teacher()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.teachers (id, email, name, school)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    coalesce(new.raw_user_meta_data ->> 'school', '')
  )
  on conflict (id) do update
    set email = excluded.email,
        name = coalesce(nullif(excluded.name, ''), teachers.name),
        school = coalesce(nullif(excluded.school, ''), teachers.school);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_teacher();
