-- ============================================================
-- 016 — Add stock_note to dishes
-- Lets the chef annotate a dish with a low-stock count or note
-- ("3 left", "last batch") without making it fully unavailable.
-- Used by the Kitchen Display inventory panel.
-- Idempotent — safe to re-run.
-- ============================================================
alter table public.dishes
  add column if not exists stock_note text;
