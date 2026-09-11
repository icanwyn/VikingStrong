-- VikingStrong: Teacher Assistant logins
-- Run once in Supabase SQL editor (Project → SQL → New query → Run).
-- Safe to run more than once.

create table if not exists public.teacher_assistants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique,
  owner_teacher_id uuid not null references public.teachers(id) on delete cascade,
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

-- Skip making a standalone teacher row when the signup is a TA.
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

-- TAs can read the teacher they assist.
drop policy if exists "ta_select_owner_teacher" on public.teachers;
create policy "ta_select_owner_teacher" on public.teachers
  for select to authenticated
  using (
    id in (
      select owner_teacher_id from public.teacher_assistants
      where user_id = auth.uid()
    )
  );

-- TAs can read the class roster and skills, and enter/edit scores.
drop policy if exists "ta_select_students" on public.students;
create policy "ta_select_students" on public.students
  for select to authenticated
  using (
    teacher_id in (
      select owner_teacher_id from public.teacher_assistants
      where user_id = auth.uid()
    )
  );

drop policy if exists "ta_update_students" on public.students;
create policy "ta_update_students" on public.students
  for update to authenticated
  using (
    teacher_id in (
      select owner_teacher_id from public.teacher_assistants
      where user_id = auth.uid()
    )
  )
  with check (
    teacher_id in (
      select owner_teacher_id from public.teacher_assistants
      where user_id = auth.uid()
    )
  );

drop policy if exists "ta_select_skills" on public.skills;
create policy "ta_select_skills" on public.skills
  for select to authenticated
  using (
    teacher_id in (
      select owner_teacher_id from public.teacher_assistants
      where user_id = auth.uid()
    )
  );

drop policy if exists "ta_select_entries" on public.entries;
create policy "ta_select_entries" on public.entries
  for select to authenticated
  using (
    exists (
      select 1
      from public.students s
      join public.teacher_assistants ta on ta.owner_teacher_id = s.teacher_id
      where s.id = entries.student_id
        and ta.user_id = auth.uid()
    )
  );

drop policy if exists "ta_insert_entries" on public.entries;
create policy "ta_insert_entries" on public.entries
  for insert to authenticated
  with check (
    exists (
      select 1
      from public.students s
      join public.teacher_assistants ta on ta.owner_teacher_id = s.teacher_id
      where s.id = entries.student_id
        and ta.user_id = auth.uid()
    )
  );

drop policy if exists "ta_update_entries" on public.entries;
create policy "ta_update_entries" on public.entries
  for update to authenticated
  using (
    exists (
      select 1
      from public.students s
      join public.teacher_assistants ta on ta.owner_teacher_id = s.teacher_id
      where s.id = entries.student_id
        and ta.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.students s
      join public.teacher_assistants ta on ta.owner_teacher_id = s.teacher_id
      where s.id = entries.student_id
        and ta.user_id = auth.uid()
    )
  );

-- TAs created by a teacher should be able to sign in without a confirmation email.
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
    and u.id in (
      select ta.user_id
      from public.teacher_assistants ta
      where ta.user_id is not null
        and ta.owner_teacher_id = auth.uid()
    );
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.confirm_ta_emails() from public;
grant execute on function public.confirm_ta_emails() to authenticated;

update auth.users u
set email_confirmed_at = coalesce(u.email_confirmed_at, now())
where u.email_confirmed_at is null
  and u.id in (
    select ta.user_id from public.teacher_assistants ta where ta.user_id is not null
  );
