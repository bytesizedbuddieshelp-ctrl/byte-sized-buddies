-- Starter data. Run this once, after schema.sql. It is safe to run again.

-- Public settings. Change site_url to your real site address (keep the quote marks).
insert into public.settings (key, value, is_public) values
  ('site_url',      '"https://YOUR-SITE-ADDRESS"'::jsonb, true),
  ('opener_video',  'null'::jsonb,                        true),
  ('closer_video',  'null'::jsonb,                        true)
on conflict (key) do nothing;

-- One draft lesson so you can test the lesson tools later. Only you can see a draft.
insert into public.lessons (slug, week_number, title, summary, topic, status)
values ('sample-lesson-delete-me', 1, 'Sample lesson (delete me)',
        'A draft used for testing. Delete it when you make your first real lesson.', 'Testing', 'draft')
on conflict (slug) do nothing;
