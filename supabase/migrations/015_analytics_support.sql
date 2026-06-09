-- ============================================================
-- 015 — Analytics support
-- Adds the columns the Analytics dashboard needs:
--   • orders: status-transition timestamps so cook time / wait time
--     can be measured (the schema previously only had created_at).
--   • analytics_events: a metadata jsonb for user-agent / device /
--     session info, powering the Customers tab (device breakdown,
--     unique visitors, AR-vs-menu views).
-- All additive + idempotent — safe to run on the live DB.
-- ============================================================

-- 1. Order status-transition timestamps.
--    Stamped by the admin Live Orders board and the staff Kitchen Display
--    as an order advances: pending → preparing → ready → delivered.
alter table public.orders
  add column if not exists preparing_at timestamptz,
  add column if not exists ready_at     timestamptz,
  add column if not exists delivered_at timestamptz;

-- 2. Free-form metadata on analytics events (user_agent, device_id,
--    session_id, view_type, etc.). Defaults to an empty object.
alter table public.analytics_events
  add column if not exists metadata jsonb not null default '{}'::jsonb;
