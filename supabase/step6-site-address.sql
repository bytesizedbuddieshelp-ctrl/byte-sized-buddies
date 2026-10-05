-- Step 6 of docs/DEPLOY.md: save your site address.
-- 1. Change https://YOUR-SITE-ADDRESS to your real address, with no slash at the end.
--    Keep the quote marks, including the double quotes inside the single quotes.
-- 2. Select ALL of this file, copy it, paste it into the Supabase SQL editor, and click Run.

update public.settings
set value = '"https://YOUR-SITE-ADDRESS"'::jsonb
where key = 'site_url';

-- Check: this should show your address.
select key, value from public.settings where key = 'site_url';
