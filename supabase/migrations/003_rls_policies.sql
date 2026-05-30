-- ============================================================
-- 3DM — RLS Policies + Realtime
-- Run this in the Supabase SQL Editor after 002_schema_v2.sql.
-- ============================================================

-- ────────────────────────────────────────
-- Add owner_id to restaurants
-- Links a restaurant row to the Supabase auth user who owns it.
-- ────────────────────────────────────────
alter table public.restaurants
  add column if not exists owner_id uuid references auth.users on delete set null;

-- ────────────────────────────────────────
-- Helper: returns the calling user's restaurant id
-- ────────────────────────────────────────
create or replace function public.my_restaurant_id()
returns uuid
language sql stable security definer
as $$
  select id from public.restaurants where owner_id = auth.uid() limit 1;
$$;

-- ============================================================
-- restaurants
-- Authenticated users can only read/write their own row.
-- ============================================================
drop policy if exists "restaurants: owner select" on public.restaurants;
drop policy if exists "restaurants: owner insert" on public.restaurants;
drop policy if exists "restaurants: owner update" on public.restaurants;

create policy "restaurants: owner select"
  on public.restaurants for select
  to authenticated
  using (owner_id = auth.uid());

create policy "restaurants: owner insert"
  on public.restaurants for insert
  to authenticated
  with check (owner_id = auth.uid());

create policy "restaurants: owner update"
  on public.restaurants for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- ============================================================
-- menus
-- Authenticated: full access to own restaurant's rows.
-- Anon: read-only (guests need to browse the menu).
-- ============================================================
drop policy if exists "menus: owner all" on public.menus;
drop policy if exists "menus: anon select" on public.menus;

create policy "menus: owner all"
  on public.menus for all
  to authenticated
  using (restaurant_id = public.my_restaurant_id())
  with check (restaurant_id = public.my_restaurant_id());

create policy "menus: anon select"
  on public.menus for select
  to anon
  using (true);

-- ============================================================
-- categories
-- Authenticated: full access via menu → restaurant chain.
-- Anon: read-only.
-- ============================================================
drop policy if exists "categories: owner all" on public.categories;
drop policy if exists "categories: anon select" on public.categories;

create policy "categories: owner all"
  on public.categories for all
  to authenticated
  using (
    exists (
      select 1 from public.menus
      where menus.id = categories.menu_id
        and menus.restaurant_id = public.my_restaurant_id()
    )
  )
  with check (
    exists (
      select 1 from public.menus
      where menus.id = categories.menu_id
        and menus.restaurant_id = public.my_restaurant_id()
    )
  );

create policy "categories: anon select"
  on public.categories for select
  to anon
  using (true);

-- ============================================================
-- dishes
-- Authenticated: full access via category → menu → restaurant.
-- Anon: read-only.
-- ============================================================
drop policy if exists "dishes: owner all" on public.dishes;
drop policy if exists "dishes: anon select" on public.dishes;

create policy "dishes: owner all"
  on public.dishes for all
  to authenticated
  using (
    exists (
      select 1 from public.categories c
      join public.menus m on m.id = c.menu_id
      where c.id = dishes.category_id
        and m.restaurant_id = public.my_restaurant_id()
    )
  )
  with check (
    exists (
      select 1 from public.categories c
      join public.menus m on m.id = c.menu_id
      where c.id = dishes.category_id
        and m.restaurant_id = public.my_restaurant_id()
    )
  );

create policy "dishes: anon select"
  on public.dishes for select
  to anon
  using (true);

-- ============================================================
-- tables
-- Authenticated: full access to own restaurant's rows.
-- Anon: read-only (guests scan QR → need to read table info).
-- ============================================================
drop policy if exists "tables: owner all" on public.tables;
drop policy if exists "tables: anon select" on public.tables;

create policy "tables: owner all"
  on public.tables for all
  to authenticated
  using (restaurant_id = public.my_restaurant_id())
  with check (restaurant_id = public.my_restaurant_id());

create policy "tables: anon select"
  on public.tables for select
  to anon
  using (true);

-- ============================================================
-- staff
-- Authenticated only — no guest access.
-- ============================================================
drop policy if exists "staff: owner all" on public.staff;

create policy "staff: owner all"
  on public.staff for all
  to authenticated
  using (restaurant_id = public.my_restaurant_id())
  with check (restaurant_id = public.my_restaurant_id());

-- ============================================================
-- loyalty_points
-- Authenticated only — no guest access.
-- ============================================================
drop policy if exists "loyalty_points: owner all" on public.loyalty_points;

create policy "loyalty_points: owner all"
  on public.loyalty_points for all
  to authenticated
  using (restaurant_id = public.my_restaurant_id())
  with check (restaurant_id = public.my_restaurant_id());

-- ============================================================
-- orders
-- Anon: INSERT (guests place orders without an account).
-- Authenticated: SELECT + UPDATE for own restaurant's orders.
-- ============================================================
drop policy if exists "orders: anon insert" on public.orders;
drop policy if exists "orders: owner select" on public.orders;
drop policy if exists "orders: owner update" on public.orders;

create policy "orders: anon insert"
  on public.orders for insert
  to anon
  with check (true);

create policy "orders: owner select"
  on public.orders for select
  to authenticated
  using (restaurant_id = public.my_restaurant_id());

create policy "orders: owner update"
  on public.orders for update
  to authenticated
  using (restaurant_id = public.my_restaurant_id())
  with check (restaurant_id = public.my_restaurant_id());

-- ============================================================
-- order_items
-- Anon: INSERT (placed alongside the order).
-- Authenticated: SELECT + UPDATE via parent order → restaurant.
-- ============================================================
drop policy if exists "order_items: anon insert" on public.order_items;
drop policy if exists "order_items: owner select" on public.order_items;
drop policy if exists "order_items: owner update" on public.order_items;

create policy "order_items: anon insert"
  on public.order_items for insert
  to anon
  with check (true);

create policy "order_items: owner select"
  on public.order_items for select
  to authenticated
  using (
    exists (
      select 1 from public.orders
      where orders.id = order_items.order_id
        and orders.restaurant_id = public.my_restaurant_id()
    )
  );

create policy "order_items: owner update"
  on public.order_items for update
  to authenticated
  using (
    exists (
      select 1 from public.orders
      where orders.id = order_items.order_id
        and orders.restaurant_id = public.my_restaurant_id()
    )
  );

-- ============================================================
-- analytics_events
-- Anon: INSERT (track dish views, AR launches, etc.).
-- Authenticated: SELECT for own restaurant.
-- ============================================================
drop policy if exists "analytics_events: anon insert" on public.analytics_events;
drop policy if exists "analytics_events: owner select" on public.analytics_events;

create policy "analytics_events: anon insert"
  on public.analytics_events for insert
  to anon
  with check (true);

create policy "analytics_events: owner select"
  on public.analytics_events for select
  to authenticated
  using (restaurant_id = public.my_restaurant_id());

-- ============================================================
-- Realtime
-- Enable for the three tables that need live updates.
-- ============================================================
alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.order_items;
alter publication supabase_realtime add table public.analytics_events;
