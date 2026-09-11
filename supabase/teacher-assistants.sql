-- VikingStrong: Teacher Assistant logins
-- Run in the VikingStrong Supabase project:
--   https://supabase.com/dashboard/project/jhklcmxtvrinfntjwhaw/sql
-- Safe to run more than once.

create table if not exists public.teachers (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text default '',
  school text default '',
  created_at timestamptz not null default now()
);

alter table public.teachers enable row level security;

create table if not exists public.teacher_assistants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique,
  owner_teacher_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  name text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists teacher_assistants_owner_idx
  on public.teacher_assistants (owner_teacher_id);
create index if not exists teacher_assistants_user_idx
  on public.teacher_assistants (user_id);

alter table public.teacher_assistants enable row level security;

drop policy if exists "ta_select_own" on public.teacher_assistants;
create policy "ta_select_own" on public.teacher_assistants
  for select to authenticated
  using (owner_teacher_id = auth.uid() or user_id = auth.uid());

drop policy if exists "ta_insert_owner" on public.teacher_assistants;
create policy "ta_insert_owner" on public.teacher_assistants
  for insert to authenticated
  with check (owner_teacher_id = auth.uid());

drop policy if exists "ta_update_owner" on public.teacher_assistants;
create policy "ta_update_owner" on public.teacher_assistants
  for update to authenticated
  using (owner_teacher_id = auth.uid() or user_id = auth.uid())
  with check (owner_teacher_id = auth.uid() or user_id = auth.uid());

drop policy if exists "ta_delete_owner" on public.teacher_assistants;
create policy "ta_delete_owner" on public.teacher_assistants
  for delete to authenticated
  using (owner_teacher_id = auth.uid());

grant select, insert, update, delete on public.teacher_assistants to authenticated;

create or replace function public.handle_new_teacher()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.raw_user_meta_data ->> 'role', '') = 'ta' then
    return new;
  end if;
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

drop policy if exists "ta_select_owner_teacher" on public.teachers;
create policy "ta_select_owner_teacher" on public.teachers
  for select to authenticated
  using (
    id in (
      select owner_teacher_id from public.teacher_assistants
      where user_id = auth.uid()
    )
  );

do $$
begin
  if to_regclass('public.students') is null then
    raise notice 'public.students not found — open the VikingStrong project jhklcmxtvrinfntjwhaw';
  else
    execute 'drop policy if exists "ta_select_students" on public.students';
    execute $p$create policy "ta_select_students" on public.students
      for select to authenticated
      using (teacher_id in (select owner_teacher_id from public.teacher_assistants where user_id = auth.uid()))$p$;
    execute 'drop policy if exists "ta_update_students" on public.students';
    execute $p$create policy "ta_update_students" on public.students
      for update to authenticated
      using (teacher_id in (select owner_teacher_id from public.teacher_assistants where user_id = auth.uid()))
      with check (teacher_id in (select owner_teacher_id from public.teacher_assistants where user_id = auth.uid()))$p$;
  end if;

  if to_regclass('public.skills') is not null then
    execute 'drop policy if exists "ta_select_skills" on public.skills';
    execute $p$create policy "ta_select_skills" on public.skills
      for select to authenticated
      using (teacher_id in (select owner_teacher_id from public.teacher_assistants where user_id = auth.uid()))$p$;
  end if;

  if to_regclass('public.entries') is not null then
    execute 'drop policy if exists "ta_select_entries" on public.entries';
    execute $p$create policy "ta_select_entries" on public.entries
      for select to authenticated
      using (exists (
        select 1 from public.students s
        join public.teacher_assistants ta on ta.owner_teacher_id = s.teacher_id
        where s.id = entries.student_id and ta.user_id = auth.uid()
      ))$p$;
    execute 'drop policy if exists "ta_insert_entries" on public.entries';
    execute $p$create policy "ta_insert_entries" on public.entries
      for insert to authenticated
      with check (exists (
        select 1 from public.students s
        join public.teacher_assistants ta on ta.owner_teacher_id = s.teacher_id
        where s.id = entries.student_id and ta.user_id = auth.uid()
      ))$p$;
    execute 'drop policy if exists "ta_update_entries" on public.entries';
    execute $p$create policy "ta_update_entries" on public.entries
      for update to authenticated
      using (exists (
        select 1 from public.students s
        join public.teacher_assistants ta on ta.owner_teacher_id = s.teacher_id
        where s.id = entries.student_id and ta.user_id = auth.uid()
      ))
      with check (exists (
        select 1 from public.students s
        join public.teacher_assistants ta on ta.owner_teacher_id = s.teacher_id
        where s.id = entries.student_id and ta.user_id = auth.uid()
      ))$p$;
  end if;
end $$;

create or replace function public.confirm_ta_emails()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n int;
begin
  update auth.users u
  set email_confirmed_at = coalesce(u.email_confirmed_at, now())
  where u.email_confirmed_at is null
    and (
      u.id in (
        select ta.user_id
        from public.teacher_assistants ta
        where ta.user_id is not null
          and ta.owner_teacher_id = auth.uid()
      )
      or lower(u.email) in (
        select lower(ta.email)
        from public.teacher_assistants ta
        where ta.owner_teacher_id = auth.uid()
      )
      or coalesce(u.raw_user_meta_data ->> 'role', '') = 'ta'
    );
  get diagnostics n = row_count;

  update auth.identities i
  set identity_data = jsonb_set(coalesce(i.identity_data, '{}'::jsonb), '{email_verified}', 'true'::jsonb, true),
      updated_at = now()
  where i.user_id in (
    select ta.user_id from public.teacher_assistants ta
    where ta.user_id is not null and ta.owner_teacher_id = auth.uid()
  )
  or i.user_id in (
    select u.id from auth.users u
    where coalesce(u.raw_user_meta_data ->> 'role', '') = 'ta'
  );

  return n;
end;
$$;

revoke all on function public.confirm_ta_emails() from public;
grant execute on function public.confirm_ta_emails() to authenticated;

update auth.users u
set email_confirmed_at = now()
where u.email_confirmed_at is null;

update auth.identities i
set identity_data = jsonb_set(coalesce(i.identity_data, '{}'::jsonb), '{email_verified}', 'true'::jsonb, true),
    updated_at = now();

create or replace function public.confirm_assistant_email(p_email text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authorized';
  end if;
  update auth.users u
  set email_confirmed_at = now()
  where lower(u.email) = lower(btrim(p_email))
    and (
      exists (
        select 1 from public.teacher_assistants ta
        where ta.owner_teacher_id = auth.uid()
          and lower(ta.email) = lower(u.email)
      )
      or coalesce(u.raw_user_meta_data ->> 'role', '') = 'ta'
    );
  update auth.identities i
  set identity_data = jsonb_set(coalesce(i.identity_data, '{}'::jsonb), '{email_verified}', 'true'::jsonb, true),
      updated_at = now()
  where i.user_id in (
    select id from auth.users where lower(email) = lower(btrim(p_email))
  );
  return true;
end;
$$;

revoke all on function public.confirm_assistant_email(text) from public;
grant execute on function public.confirm_assistant_email(text) to authenticated;

create or replace function public.verify_student_code(p_student_id uuid, p_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare ok boolean;
begin
  select lower(btrim(coalesce(access_code, ''))) = lower(btrim(coalesce(p_code, '')))
  into ok
  from public.students
  where id = p_student_id;
  return coalesce(ok, false);
end;
$$;

revoke all on function public.verify_student_code(uuid, text) from public;
grant execute on function public.verify_student_code(uuid, text) to anon, authenticated;
