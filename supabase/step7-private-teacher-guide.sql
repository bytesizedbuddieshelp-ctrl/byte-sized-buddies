-- Step 7: make teacher guides private (owner only).
-- Select ALL of this file, copy it, paste it into the Supabase SQL editor, and click Run.
-- It is safe to run again. The same rules are in schema.sql.

-- 1. Strangers may read every lesson column EXCEPT teacher_guide_md.
--    (If you ever add a column to lessons that strangers should see, add it to this list too.)
revoke select on public.lessons from anon;
grant select (id, slug, week_number, title, summary, topic, devices, level, duration_minutes, objectives,
              slides, video_script_md, files, video_ids, license, status, published_at, created_at, updated_at)
  on public.lessons to anon;

-- 2. A private bucket for teacher guide PDFs. Nobody can open a file here by its web address;
--    only the signed-in owner can read, add, change, or delete files.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lesson-private', 'lesson-private', false, 10485760, array['application/pdf'])
on conflict (id) do update
   set public = excluded.public, file_size_limit = excluded.file_size_limit,
       allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "lesson-private owner read" on storage.objects;
create policy "lesson-private owner read" on storage.objects for select to authenticated
  using (bucket_id = 'lesson-private' and public.is_owner());
drop policy if exists "lesson-private owner insert" on storage.objects;
create policy "lesson-private owner insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'lesson-private' and public.is_owner());
drop policy if exists "lesson-private owner update" on storage.objects;
create policy "lesson-private owner update" on storage.objects for update to authenticated
  using (bucket_id = 'lesson-private' and public.is_owner())
  with check (bucket_id = 'lesson-private' and public.is_owner());
drop policy if exists "lesson-private owner delete" on storage.objects;
create policy "lesson-private owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'lesson-private' and public.is_owner());

-- Check: this should show lesson-private with public = false.
select id, public from storage.buckets where id in ('lesson-files', 'lesson-private');
