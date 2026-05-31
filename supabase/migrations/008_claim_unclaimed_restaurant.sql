-- ============================================================
-- 3DM — Allow authenticated users to see and claim restaurants
-- that have no owner yet (owner_id IS NULL).
--
-- Needed for:
--   1. Dev / seed data where the test restaurant was created
--      without an owner_id.
--   2. Post-email-confirmation flow: user signed up, confirmed
--      their email, logged in — but the restaurant insert was
--      deferred because there was no session at signup time.
-- ============================================================

-- Allow any authenticated user to SELECT unclaimed restaurants
drop policy if exists "restaurants: claim unclaimed select" on public.restaurants;
create policy "restaurants: claim unclaimed select"
  on public.restaurants for select
  to authenticated
  using (owner_id is null);

-- Allow any authenticated user to UPDATE (claim) an unclaimed restaurant
-- The WITH CHECK ensures they can only set owner_id to their own UID.
drop policy if exists "restaurants: claim unclaimed update" on public.restaurants;
create policy "restaurants: claim unclaimed update"
  on public.restaurants for update
  to authenticated
  using (owner_id is null)
  with check (owner_id = auth.uid());
