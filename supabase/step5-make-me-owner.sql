-- Step 5 of docs/DEPLOY.md: tell the database that you are the owner.
-- 1. Change YOUR-EMAIL-HERE to the email you used in Step 3. Keep the quote marks.
-- 2. Select ALL of this file, copy it, paste it into the Supabase SQL editor, and click Run.

insert into public.owners (user_id)
select id from auth.users where email = 'YOUR-EMAIL-HERE'
on conflict do nothing;

-- Check: this should show exactly one row.
select * from public.owners;
