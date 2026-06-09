-- ============================================================
-- Migration 012 — Staff Console support
-- Run in the Supabase SQL Editor.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. staff_login RPC
-- The staff app uses the anon key. The `staff` table is RLS-locked to
-- authenticated owners only, and we must NOT expose every PIN via an anon
-- SELECT. Instead this security-definer function verifies the PIN server-side
-- and returns only the matched staff member's id/name/role (or null).
-- ────────────────────────────────────────────────────────────
create or replace function public.staff_login(
  p_restaurant_id uuid,
  p_pin           text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff record;
begin
  select id, name, role
  into v_staff
  from public.staff
  where restaurant_id = p_restaurant_id
    and pin = p_pin
    and coalesce(is_active, true) = true
  limit 1;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'id',   v_staff.id,
    'name', v_staff.name,
    'role', v_staff.role
  );
end;
$$;

grant execute on function public.staff_login to anon;

-- ────────────────────────────────────────────────────────────
-- 2. Anon read on order_items
-- The kitchen display (anon key) must read the line items for each active
-- order. orders already allow anon SELECT (migration 011).
-- ────────────────────────────────────────────────────────────
drop policy if exists "order_items: anon select" on public.order_items;
create policy "order_items: anon select"
  on public.order_items for select
  to anon
  using (true);

-- ────────────────────────────────────────────────────────────
-- 3. Anon update on orders
-- The kitchen display advances order status (Cook All -> preparing,
-- Done -> ready). MVP-permissive: any anon client on this project can update
-- an order's status. Tighten with proper staff auth before production.
-- ────────────────────────────────────────────────────────────
drop policy if exists "orders: anon update" on public.orders;
create policy "orders: anon update"
  on public.orders for update
  to anon
  using (true)
  with check (true);

-- ────────────────────────────────────────────────────────────
-- 4. Seed test staff for the "test" restaurant so PIN login works now.
--    Waiter PIN 1234, Chef PIN 5678. Idempotent.
-- ────────────────────────────────────────────────────────────
insert into public.staff (restaurant_id, name, role, pin, is_active)
select '3cb611fa-132c-4cbd-ba48-03bd7fd86bbf', 'Test Waiter', 'waiter', '1234', true
where not exists (
  select 1 from public.staff
  where restaurant_id = '3cb611fa-132c-4cbd-ba48-03bd7fd86bbf' and pin = '1234'
);

insert into public.staff (restaurant_id, name, role, pin, is_active)
select '3cb611fa-132c-4cbd-ba48-03bd7fd86bbf', 'Test Chef', 'chef', '5678', true
where not exists (
  select 1 from public.staff
  where restaurant_id = '3cb611fa-132c-4cbd-ba48-03bd7fd86bbf' and pin = '5678'
);
