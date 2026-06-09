-- ============================================================
-- 020 — Billing / GST settings
-- Adds the columns the bill generator + admin Billing Settings need.
-- gstin and address already exist on the v2 schema; included here with
-- `if not exists` so this migration is safe on any environment.
-- All additive + idempotent.
-- ============================================================

alter table public.restaurants
  add column if not exists gst_slab numeric default 5,
  add column if not exists address  text,
  add column if not exists hsn_code text default '996331';

-- Backfill any existing rows that predate the defaults.
update public.restaurants set gst_slab = 5         where gst_slab is null;
update public.restaurants set hsn_code = '996331'  where hsn_code is null;
