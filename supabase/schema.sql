-- Byte-Sized Buddies: the whole database.
-- Paste this into the Supabase SQL editor and press Run. It is safe to run again.
-- Security comes from row-level security (RLS): every table has it turned on, and
-- strangers can only do the few things the functions below allow.
-- Never put the service_role key in this project.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Who is the owner?
-- ---------------------------------------------------------------------------
create table if not exists public.owners (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.owners enable row level security;   -- no policies: nobody reads it directly

create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.owners where user_id = auth.uid()); $$;

-- ---------------------------------------------------------------------------
-- Site settings (some are public, like the site address and opener/closer videos)
-- ---------------------------------------------------------------------------
create table if not exists public.settings (
  key text primary key,
  value jsonb not null,
  is_public boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.settings enable row level security;
drop policy if exists "owner all" on public.settings;
create policy "owner all" on public.settings for all using (public.is_owner()) with check (public.is_owner());
drop policy if exists "public read public settings" on public.settings;
create policy "public read public settings" on public.settings for select using (is_public);

-- ---------------------------------------------------------------------------
-- Lessons
-- ---------------------------------------------------------------------------
create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  week_number int check (week_number between 1 and 200),
  title text not null check (char_length(title) between 1 and 120),
  summary text check (char_length(summary) <= 400),
  topic text,
  devices text[] not null default '{any}',
  level text not null default 'beginner' check (level in ('beginner','intermediate')),
  duration_minutes int not null default 45,
  objectives text[] not null default '{}',
  slides jsonb not null default '{"version":1,"slides":[]}',
  teacher_guide_md text,
  video_script_md text,
  files jsonb not null default '{}',      -- {"worksheet":{"path":"...","bytes":123},"handout":{...},"answer_key":{...},"teacher_guide_pdf":{...},"images":[{"name":"x.png","path":"...","bytes":1}]}
  video_ids jsonb not null default '[]',  -- ordered list of {"youtube_id":"...","label":"..."}
  license text not null default 'CC BY-SA 4.0',
  status text not null default 'draft' check (status in ('draft','published')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.lessons enable row level security;
drop policy if exists "owner all" on public.lessons;
create policy "owner all" on public.lessons for all using (public.is_owner()) with check (public.is_owner());
drop policy if exists "public read published" on public.lessons;
create policy "public read published" on public.lessons for select using (status = 'published');

-- Keep updated_at honest.
create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = public as
$$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists lessons_touch on public.lessons;
create trigger lessons_touch before update on public.lessons for each row execute function public.touch_updated_at();
drop trigger if exists settings_touch on public.settings;
create trigger settings_touch before update on public.settings for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Videos made in the studio (or any YouTube link the owner wants to keep)
-- ---------------------------------------------------------------------------
create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid references public.lessons(id) on delete set null,
  ticket_id uuid,
  title text not null,
  kind text not null default 'lesson' check (kind in ('lesson','ticket_answer','opener','closer','other')),
  segments jsonb not null default '[]',   -- ordered [{"youtube_id":"...","label":"Opener"}, ...]
  script_md text,
  created_at timestamptz not null default now()
);
alter table public.videos enable row level security;
drop policy if exists "owner all" on public.videos;
create policy "owner all" on public.videos for all using (public.is_owner()) with check (public.is_owner());

-- ---------------------------------------------------------------------------
-- Help tickets
-- ---------------------------------------------------------------------------
create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  token text not null unique check (char_length(token) >= 32),
  created_at timestamptz not null default now(),
  status text not null default 'new' check (status in ('new','in_progress','answered','closed')),
  requester_name text not null check (char_length(requester_name) between 1 and 80),
  facility text check (char_length(facility) <= 120),
  requester_email text check (char_length(requester_email) <= 200),
  device text check (device in ('iphone','android','tablet','computer','not_sure')),
  urgency text not null default 'whenever' check (urgency in ('whenever','this_week','before_next_visit')),
  question text not null check (char_length(question) between 5 and 2000),
  internal_notes text,
  answer_md text,
  answer_video_youtube_id text check (answer_video_youtube_id ~ '^[A-Za-z0-9_-]{11}$'),
  answered_at timestamptz,
  owner_notified_at timestamptz
);
alter table public.tickets enable row level security;
drop policy if exists "owner all" on public.tickets;
create policy "owner all" on public.tickets for all using (public.is_owner()) with check (public.is_owner());

-- ---------------------------------------------------------------------------
-- Requests from senior homes
-- ---------------------------------------------------------------------------
create table if not exists public.contact_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  status text not null default 'new' check (status in ('new','replied','scheduled','closed')),
  contact_name text not null check (char_length(contact_name) between 1 and 80),
  facility text not null check (char_length(facility) between 1 and 120),
  role text check (char_length(role) <= 80),
  email text not null check (char_length(email) between 5 and 200),
  phone text check (char_length(phone) <= 40),
  learner_count text check (char_length(learner_count) <= 40),
  devices text[] not null default '{}',
  preferred_times text check (char_length(preferred_times) <= 300),
  message text check (char_length(message) <= 2000),
  internal_notes text,
  owner_notified_at timestamptz
);
alter table public.contact_requests enable row level security;
drop policy if exists "owner all" on public.contact_requests;
create policy "owner all" on public.contact_requests for all using (public.is_owner()) with check (public.is_owner());

-- ---------------------------------------------------------------------------
-- Gmail copies (written only by the bridge) and the outgoing mail queue
-- ---------------------------------------------------------------------------
create table if not exists public.inbox_messages (
  id uuid primary key default gen_random_uuid(),
  gmail_message_id text not null unique,
  gmail_thread_id text not null,
  from_name text, from_email text, subject text,
  body_text text,                    -- plain text, cut to 8000 characters by the bridge
  received_at timestamptz not null,
  is_read boolean not null default false,
  handled boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.inbox_messages enable row level security;
drop policy if exists "owner all" on public.inbox_messages;
create policy "owner all" on public.inbox_messages for all using (public.is_owner()) with check (public.is_owner());

create table if not exists public.outbox (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('reply','ticket_received','ticket_answered','contact_received','note_to_owner')),
  to_email text not null check (char_length(to_email) <= 200 and to_email !~ '[\r\n]'),
  subject text not null check (char_length(subject) <= 200 and subject !~ '[\r\n]'),
  body_text text not null check (char_length(body_text) <= 10000),
  gmail_thread_id text,               -- set for replies
  status text not null default 'queued' check (status in ('queued','sent','error')),
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
alter table public.outbox enable row level security;
drop policy if exists "owner all" on public.outbox;
create policy "owner all" on public.outbox for all using (public.is_owner()) with check (public.is_owner());

-- ---------------------------------------------------------------------------
-- Bridge secret (only a hash is stored; the secret itself lives in Apps Script)
-- ---------------------------------------------------------------------------
create table if not exists public.bridge_secret (
  id int primary key default 1 check (id = 1),
  secret_hash text not null
);
alter table public.bridge_secret enable row level security;   -- no policies

create or replace function public.bridge_ok(p_secret text) returns boolean
language sql stable security definer set search_path = public, extensions as
$$ select coalesce((select secret_hash = encode(digest(p_secret,'sha256'),'hex') from public.bridge_secret where id = 1), false); $$;
revoke all on function public.bridge_ok(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Table permissions. RLS is the real lock; this is a second lock on the door.
-- Supabase gives its API roles access to new tables by default, so we take it back.
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
grant select on public.lessons, public.settings to anon;
revoke all on public.owners, public.bridge_secret from authenticated;

-- ---------------------------------------------------------------------------
-- Public functions (a stranger may call these)
-- Supabase also gives new functions to anon and authenticated by default, so each
-- function below revokes everything first, then grants only what it should.
-- ---------------------------------------------------------------------------

-- Anyone can type any email address into the public forms, so confirmation emails are limited:
--   * no more than 30 confirmation emails an hour in total, and
--   * no more than 3 a day to one inbox. "name+anything@example.com" counts as "name@example.com".
-- (Providers that ignore dots, like Gmail, can still treat a.b@ and ab@ as different here. The hourly total
--  keeps that harmless.) The question or request is always saved; only the email is skipped.
create or replace function public.can_queue_public_email(p_email text) returns boolean
language sql stable set search_path = public as $$
  select
    (select count(*) from public.outbox
      where kind in ('ticket_received', 'contact_received') and created_at > now() - interval '1 hour') < 30
    and
    (select count(*) from public.outbox
      where kind in ('ticket_received', 'contact_received') and created_at > now() - interval '1 day'
        and lower(regexp_replace(split_part(to_email, '@', 1), '\+.*$', '')) || '@' || lower(split_part(to_email, '@', 2))
          = lower(regexp_replace(split_part(p_email, '@', 1), '\+.*$', '')) || '@' || lower(split_part(p_email, '@', 2))
    ) < 3;
$$;
revoke all on function public.can_queue_public_email(text) from public, anon, authenticated;

-- A question from the Ask page. The browser makes the private token.
create or replace function public.submit_ticket(
  p_token text, p_name text, p_facility text, p_email text,
  p_device text, p_urgency text, p_question text, p_website text
) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_name     text := btrim(coalesce(p_name, ''));
  v_facility text := nullif(btrim(coalesce(p_facility, '')), '');
  v_email    text := nullif(btrim(coalesce(p_email, '')), '');
  v_device   text := nullif(btrim(coalesce(p_device, '')), '');
  v_urgency  text := coalesce(nullif(btrim(coalesce(p_urgency, '')), ''), 'whenever');
  v_question text := btrim(coalesce(p_question, ''));
  v_site     text;
begin
  -- Spam trap: real people never fill in the hidden "website" field. Pretend it worked.
  if btrim(coalesce(p_website, '')) <> '' then return; end if;

  if p_token is null or p_token !~ '^[0-9a-f]{64,128}$' then
    raise exception 'Something went wrong. Please try again.';
  end if;
  if char_length(v_name) not between 1 and 80 then raise exception 'Please tell us your name.'; end if;
  if v_facility is not null and char_length(v_facility) > 120 then raise exception 'That facility name is too long.'; end if;
  if v_email is not null and (char_length(v_email) > 200 or v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$') then
    raise exception 'Please enter an email like name@example.com.';
  end if;
  if v_device is not null and v_device not in ('iphone','android','tablet','computer','not_sure') then v_device := null; end if;
  if v_urgency not in ('whenever','this_week','before_next_visit') then v_urgency := 'whenever'; end if;
  if char_length(v_question) not between 5 and 2000 then raise exception 'Please write between 5 and 2,000 characters.'; end if;

  if (select count(*) from public.tickets where created_at > now() - interval '1 hour') >= 20 then
    raise exception 'Too many questions right now. Please try again later.';
  end if;

  insert into public.tickets (token, requester_name, facility, requester_email, device, urgency, question)
  values (p_token, v_name, v_facility, v_email, v_device, v_urgency, v_question);

  -- Limits on confirmation emails: see can_queue_public_email above. The question is saved either way.
  if v_email is not null and public.can_queue_public_email(v_email) then
    select coalesce(value #>> '{}', '') into v_site from public.settings where key = 'site_url';
    insert into public.outbox (kind, to_email, subject, body_text)
    values (
      'ticket_received', v_email, 'We got your question',
      format(E'Hello %s,\n\nThank you for asking. We''ve received your question and will reply within two days. You don''t need an account. Your answer will appear at the private link below. Please don''t send passwords or personal details.\n\n%s/answer?t=%s\n\nByte-Sized Buddies\nLearn it. Try it. Keep it.',
             v_name, coalesce(v_site, ''), p_token)
    );
  end if;
end;
$$;
revoke all on function public.submit_ticket(text,text,text,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.submit_ticket(text,text,text,text,text,text,text,text) to anon, authenticated;

-- Read one answer, by its private token. Nothing else is ever returned.
-- A saved draft stays hidden: the answer is shown only once the ticket has been answered.
create or replace function public.get_ticket(p_token text)
returns table (
  status text, requester_name text, question text, answer_md text,
  answer_video_youtube_id text, answered_at timestamptz, created_at timestamptz
)
language sql stable security definer set search_path = public, extensions as $$
  select t.status, t.requester_name, t.question,
         case when t.answered_at is not null then t.answer_md end,
         case when t.answered_at is not null then t.answer_video_youtube_id end,
         t.answered_at, t.created_at
  from public.tickets t
  where t.token = p_token
  limit 1;
$$;
revoke all on function public.get_ticket(text) from public, anon, authenticated;
grant execute on function public.get_ticket(text) to anon, authenticated;

-- A request from a senior home.
create or replace function public.submit_contact_request(
  p_name text, p_facility text, p_role text, p_email text, p_phone text,
  p_learner_count text, p_devices text[], p_times text, p_message text, p_website text
) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_name     text := btrim(coalesce(p_name, ''));
  v_facility text := btrim(coalesce(p_facility, ''));
  v_role     text := nullif(btrim(coalesce(p_role, '')), '');
  v_email    text := btrim(coalesce(p_email, ''));
  v_phone    text := nullif(btrim(coalesce(p_phone, '')), '');
  v_learners text := nullif(btrim(coalesce(p_learner_count, '')), '');
  v_devices  text[] := coalesce(p_devices, '{}');
  v_times    text := nullif(btrim(coalesce(p_times, '')), '');
  v_message  text := nullif(btrim(coalesce(p_message, '')), '');
begin
  if btrim(coalesce(p_website, '')) <> '' then return; end if;

  if char_length(v_name) not between 1 and 80 then raise exception 'Please tell us your name.'; end if;
  if char_length(v_facility) not between 1 and 120 then raise exception 'Please tell us the name of your facility.'; end if;
  if char_length(v_email) > 200 or v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' then
    raise exception 'Please enter an email like name@example.com.';
  end if;
  if char_length(coalesce(v_role, '')) > 80 or char_length(coalesce(v_phone, '')) > 40
     or char_length(coalesce(v_learners, '')) > 40 or char_length(coalesce(v_times, '')) > 300
     or char_length(coalesce(v_message, '')) > 2000 then
    raise exception 'One of your answers is too long. Please shorten it.';
  end if;
  if cardinality(v_devices) > 5 or not (v_devices <@ array['iphone','android','tablet','computer','not_sure']) then
    v_devices := '{}';
  end if;

  if (select count(*) from public.contact_requests where created_at > now() - interval '1 hour') >= 20 then
    raise exception 'Too many requests right now. Please try again later.';
  end if;

  insert into public.contact_requests (contact_name, facility, role, email, phone, learner_count, devices, preferred_times, message)
  values (v_name, v_facility, v_role, v_email, v_phone, v_learners, v_devices, v_times, v_message);

  -- Same email limits as tickets. The request is saved either way.
  if public.can_queue_public_email(v_email) then
  insert into public.outbox (kind, to_email, subject, body_text)
  values (
    'contact_received', v_email, 'Thank you for reaching out to Byte-Sized Buddies',
    format(E'Hello %s,\n\nThank you for getting in touch. We got your request to visit %s and will write back within two days. Please don''t send passwords or personal details.\n\nByte-Sized Buddies\nLearn it. Try it. Keep it.',
           v_name, v_facility)
  );
  end if;
end;
$$;
revoke all on function public.submit_contact_request(text,text,text,text,text,text,text[],text,text,text) from public, anon, authenticated;
grant execute on function public.submit_contact_request(text,text,text,text,text,text,text[],text,text,text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Bridge functions (the Gmail script calls these; each one checks the secret)
-- They must be callable without signing in, so they are granted to anon, and
-- bridge_ok() is the lock. A wrong secret gets "not allowed" and nothing else.
-- ---------------------------------------------------------------------------

create or replace function public.bridge_get_work(p_secret text) returns json
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.bridge_ok(p_secret) then raise exception 'not allowed'; end if;
  return json_build_object(
    'outbox', coalesce((
      select json_agg(o) from (
        select id, kind, to_email, subject, body_text, gmail_thread_id
        from public.outbox where status = 'queued' order by created_at limit 20) o), '[]'::json),
    'notify_tickets', coalesce((
      select json_agg(t) from (
        select id, requester_name, question
        from public.tickets where owner_notified_at is null order by created_at limit 20) t), '[]'::json),
    'notify_contacts', coalesce((
      select json_agg(c) from (
        select id, facility, message
        from public.contact_requests where owner_notified_at is null order by created_at limit 20) c), '[]'::json)
  );
end;
$$;
revoke all on function public.bridge_get_work(text) from public, anon, authenticated;
grant execute on function public.bridge_get_work(text) to anon, authenticated;

create or replace function public.bridge_mark_outbox(p_secret text, p_id uuid, p_ok boolean, p_error text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.bridge_ok(p_secret) then raise exception 'not allowed'; end if;
  if p_ok then
    -- Private links should not linger once the email is sent.
    update public.outbox
       set status = 'sent', sent_at = now(), error = null,
           body_text = case when kind in ('ticket_received','ticket_answered','contact_received') then '[sent]' else body_text end
     where id = p_id;
  else
    update public.outbox set status = 'error', error = left(coalesce(p_error, 'Unknown error'), 300) where id = p_id;
  end if;
end;
$$;
revoke all on function public.bridge_mark_outbox(text,uuid,boolean,text) from public, anon, authenticated;
grant execute on function public.bridge_mark_outbox(text,uuid,boolean,text) to anon, authenticated;

create or replace function public.bridge_mark_notified(p_secret text, p_kind text, p_id uuid) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.bridge_ok(p_secret) then raise exception 'not allowed'; end if;
  if p_kind = 'ticket' then
    update public.tickets set owner_notified_at = now() where id = p_id;
  elsif p_kind = 'contact' then
    update public.contact_requests set owner_notified_at = now() where id = p_id;
  end if;
end;
$$;
revoke all on function public.bridge_mark_notified(text,text,uuid) from public, anon, authenticated;
grant execute on function public.bridge_mark_notified(text,text,uuid) to anon, authenticated;

create or replace function public.bridge_upsert_inbox(p_secret text, p_rows jsonb) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.bridge_ok(p_secret) then raise exception 'not allowed'; end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 100 then
    raise exception 'bad rows';
  end if;
  -- is_read and handled are never overwritten.
  insert into public.inbox_messages (gmail_message_id, gmail_thread_id, from_name, from_email, subject, body_text, received_at)
  select r.gmail_message_id, r.gmail_thread_id, r.from_name, r.from_email, r.subject, left(r.body_text, 8000), r.received_at
    from jsonb_to_recordset(p_rows) as r(
      gmail_message_id text, gmail_thread_id text, from_name text, from_email text,
      subject text, body_text text, received_at timestamptz)
  on conflict (gmail_message_id) do update
     set gmail_thread_id = excluded.gmail_thread_id, from_name = excluded.from_name,
         from_email = excluded.from_email, subject = excluded.subject,
         body_text = excluded.body_text, received_at = excluded.received_at;
end;
$$;
revoke all on function public.bridge_upsert_inbox(text,jsonb) from public, anon, authenticated;
grant execute on function public.bridge_upsert_inbox(text,jsonb) to anon, authenticated;

create or replace function public.bridge_purge(p_secret text) returns json
language plpgsql security definer set search_path = public, extensions as $$
declare n_tickets int; n_outbox int; n_inbox int;
begin
  if not public.bridge_ok(p_secret) then raise exception 'not allowed'; end if;
  delete from public.tickets
   where status in ('answered','closed') and coalesce(answered_at, created_at) < now() - interval '90 days';
  get diagnostics n_tickets = row_count;
  delete from public.outbox where status = 'sent' and sent_at < now() - interval '30 days';
  get diagnostics n_outbox = row_count;
  delete from public.inbox_messages where received_at < now() - interval '90 days';
  get diagnostics n_inbox = row_count;
  return json_build_object('tickets', n_tickets, 'outbox', n_outbox, 'inbox', n_inbox);
end;
$$;
revoke all on function public.bridge_purge(text) from public, anon, authenticated;
grant execute on function public.bridge_purge(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage: a public bucket for lesson files. Anyone may read a file by its web
-- address; only the owner may add, change, list, or delete files.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lesson-files', 'lesson-files', true, 10485760,
        array['application/pdf','image/png','image/jpeg','image/webp','image/svg+xml'])
on conflict (id) do update
   set public = excluded.public, file_size_limit = excluded.file_size_limit,
       allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "lesson-files owner insert" on storage.objects;
create policy "lesson-files owner insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'lesson-files' and public.is_owner());
drop policy if exists "lesson-files owner update" on storage.objects;
create policy "lesson-files owner update" on storage.objects for update to authenticated
  using (bucket_id = 'lesson-files' and public.is_owner())
  with check (bucket_id = 'lesson-files' and public.is_owner());
drop policy if exists "lesson-files owner delete" on storage.objects;
create policy "lesson-files owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'lesson-files' and public.is_owner());
drop policy if exists "lesson-files owner list" on storage.objects;
create policy "lesson-files owner list" on storage.objects for select to authenticated
  using (bucket_id = 'lesson-files' and public.is_owner());

-- ---------------------------------------------------------------------------
-- Phone remote: only the owner may use the private "remote:" channels (Phase 4).
-- Same as supabase/realtime-remote.sql. See docs/DEPLOY.md, Step 12.
-- ---------------------------------------------------------------------------

drop policy if exists "owner can receive remote messages" on realtime.messages;
create policy "owner can receive remote messages"
  on realtime.messages for select to authenticated
  using (
    public.is_owner()
    and realtime.messages.extension = 'broadcast'
    and (select realtime.topic()) like 'remote:%'
  );

drop policy if exists "owner can send remote messages" on realtime.messages;
create policy "owner can send remote messages"
  on realtime.messages for insert to authenticated
  with check (
    public.is_owner()
    and realtime.messages.extension = 'broadcast'
    and (select realtime.topic()) like 'remote:%'
  );
