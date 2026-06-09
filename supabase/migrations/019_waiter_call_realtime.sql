-- ============================================================
-- 019 — Waiter-call Realtime access for anon (staff app)
-- The staff app uses the anon key. Supabase Realtime
-- postgres_changes requires SELECT permission on the table.
-- We grant it but scope the RLS policy tightly: anon can only
-- see waiter_call events — all other analytics data stays hidden.
-- ============================================================

grant select on public.analytics_events to anon;

drop policy if exists "analytics_events: anon waiter_call select" on public.analytics_events;
create policy "analytics_events: anon waiter_call select"
  on public.analytics_events for select
  to anon
  using (event_type = 'waiter_call');
