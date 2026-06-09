-- ============================================================
-- 018 — Staff management + staff console redesign support
-- Run in the Supabase SQL Editor. Idempotent + additive.
--
-- Adds:
--   1. staff.last_active_at        — "who's on duty today" tracking
--   2. orders.taken_by / paid_by   — per-waiter performance attribution
--      orders.paid_at              — when payment was collected
--   3. list_active_staff RPC       — anon-safe staff roster (no PIN) for the
--                                    "Who's working today?" selection screen
--   4. staff_login RPC update      — stamps last_active_at on a successful login
--   5. Seed Ram/Sai/Jeeva/Raghul  — keeps Test Waiter (1234) + Test Chef (5678)
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. last_active_at on staff
-- ────────────────────────────────────────────────────────────
alter table public.staff
  add column if not exists last_active_at timestamptz;

-- ────────────────────────────────────────────────────────────
-- 2. Order attribution columns
--    taken_by  — staff who placed the order (waiter console)
--    paid_by   — staff who collected the payment
--    paid_at   — when the payment was recorded
--    No FK constraint so deleting a staff row never blocks/rewrites history;
--    the ids are read back against the staff roster for display.
-- ────────────────────────────────────────────────────────────
alter table public.orders
  add column if not exists taken_by uuid,
  add column if not exists paid_by  uuid,
  add column if not exists paid_at  timestamptz;

-- ────────────────────────────────────────────────────────────
-- 3. list_active_staff RPC
-- The staff app uses the anon key and the staff table is RLS-locked to
-- authenticated owners. This security-definer function returns ONLY the
-- non-secret fields (never the PIN) for active staff, so the console can
-- render the "Who's working today?" picker.
-- ────────────────────────────────────────────────────────────
create or replace function public.list_active_staff(
  p_restaurant_id uuid
) returns jsonb
language sql
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object('id', s.id, 'name', s.name, 'role', s.role)
      order by s.role, s.name
    ),
    '[]'::jsonb
  )
  from public.staff s
  where s.restaurant_id = p_restaurant_id
    and coalesce(s.is_active, true) = true;
$$;

grant execute on function public.list_active_staff to anon;

-- ────────────────────────────────────────────────────────────
-- 4. staff_login — now stamps last_active_at on success
-- (Same id/name/role payload as before; supersedes the 012 definition.)
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

  update public.staff
  set last_active_at = now()
  where id = v_staff.id;

  return jsonb_build_object(
    'id',   v_staff.id,
    'name', v_staff.name,
    'role', v_staff.role
  );
end;
$$;

grant execute on function public.staff_login to anon;

-- ────────────────────────────────────────────────────────────
-- 5. Seed staff for the test restaurant (idempotent by restaurant + PIN).
--    Test Waiter (1234) + Test Chef (5678) from migration 012 are untouched.
-- ────────────────────────────────────────────────────────────
insert into public.staff (restaurant_id, name, role, pin, is_active)
select v.restaurant_id, v.name, v.role, v.pin, true
from (values
  ('3cb611fa-132c-4cbd-ba48-03bd7fd86bbf'::uuid, 'Ram',    'waiter',  '1111'),
  ('3cb611fa-132c-4cbd-ba48-03bd7fd86bbf'::uuid, 'Sai',    'waiter',  '2222'),
  ('3cb611fa-132c-4cbd-ba48-03bd7fd86bbf'::uuid, 'Jeeva',  'chef',    '3333'),
  ('3cb611fa-132c-4cbd-ba48-03bd7fd86bbf'::uuid, 'Raghul', 'manager', '4444')
) as v(restaurant_id, name, role, pin)
where not exists (
  select 1 from public.staff s
  where s.restaurant_id = v.restaurant_id and s.pin = v.pin
);
