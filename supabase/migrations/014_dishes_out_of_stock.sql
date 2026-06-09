-- ============================================================
-- 014 — Chef can mark a dish out of stock
-- Feature 3: the kitchen display flips dishes.is_available = false.
-- The staff app runs as the anon role (PIN session, not a Supabase
-- auth user), so anon needs UPDATE on dishes. We also add dishes to
-- the realtime publication so the guest menu and waiter console pick
-- up availability changes live.
-- ============================================================

-- 1. Allow the anon (staff PIN) client to update dishes.
--    NOTE: permissive, matching the existing anon policies on orders/
--    order_items added in 012. Tighten later if staff move to real auth.
drop policy if exists "dishes: anon update" on public.dishes;
create policy "dishes: anon update"
  on public.dishes for update
  to anon
  using (true)
  with check (true);

-- 2. Stream dish changes over Realtime (idempotent — only adds once).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'dishes'
  ) then
    alter publication supabase_realtime add table public.dishes;
  end if;
end $$;
