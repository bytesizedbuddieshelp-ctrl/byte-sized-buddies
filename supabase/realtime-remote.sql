-- The phone remote (docs/DEPLOY.md, Step 12): lets ONLY the owner use the "remote:" real-time channels.
-- Without this, the remote cannot connect at all. That is on purpose: a stranger who guesses a
-- 4-letter code can neither listen to your slides and notes nor move them.
--
-- 1. Select ALL of this file, copy it, paste it into the Supabase SQL editor, and click Run.
-- 2. It is safe to run again.

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
