-- Optional nickname on students (preferred name on the board and stickers).
-- Run in the VikingStrong Supabase SQL editor. Safe to run more than once.

alter table public.students add column if not exists nickname text;
