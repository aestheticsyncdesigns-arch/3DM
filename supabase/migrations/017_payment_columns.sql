-- ============================================================
-- 017 — Razorpay payment columns
-- The guest pays from the order tracker once the order is ready.
-- Most of these already existed on older schemas; this is additive
-- and idempotent. anon already has UPDATE on orders (012) so the
-- guest can record the payment result — no new policy needed.
-- ============================================================
alter table public.orders
  add column if not exists payment_status      text default 'unpaid',
  add column if not exists payment_method      text,
  add column if not exists razorpay_order_id   text,
  add column if not exists razorpay_payment_id text;

-- payment_status existed with default 'pending' on the v2 schema — new orders
-- should default to 'unpaid' (values: unpaid / paid / failed).
alter table public.orders alter column payment_status set default 'unpaid';
