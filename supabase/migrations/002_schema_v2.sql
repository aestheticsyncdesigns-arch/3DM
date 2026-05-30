-- ============================================================
-- 3DM — Schema v2
-- Drop existing tables (if any) and recreate with correct schema.
-- Run this in the Supabase SQL Editor.
-- ============================================================

-- Drop existing tables in dependency order
drop table if exists public.analytics_events cascade;
drop table if exists public.loyalty_points cascade;
drop table if exists public.order_items cascade;
drop table if exists public.orders cascade;
drop table if exists public.staff cascade;
drop table if exists public.inventory cascade;
drop table if exists public.tables cascade;
drop table if exists public.dishes cascade;
drop table if exists public.categories cascade;
drop table if exists public.menus cascade;
drop table if exists public.restaurants cascade;

-- Drop old trigger function if it exists
drop function if exists public.handle_updated_at cascade;

-- ────────────────────────────────────────
-- restaurants
-- ────────────────────────────────────────
create table public.restaurants (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  subdomain   text        unique not null,
  gstin       text,
  logo_url    text,
  address     text,
  phone       text,
  plan        text        default 'starter',
  ar_credits  integer     default 5,
  created_at  timestamptz default now()
);

-- ────────────────────────────────────────
-- menus
-- ────────────────────────────────────────
create table public.menus (
  id             uuid        primary key default gen_random_uuid(),
  restaurant_id  uuid        references public.restaurants on delete cascade,
  name           text        not null,
  type           text        default 'regular',
  schedule_start time,
  schedule_end   time,
  is_active      boolean     default true,
  created_at     timestamptz default now()
);

-- ────────────────────────────────────────
-- categories
-- ────────────────────────────────────────
create table public.categories (
  id            uuid     primary key default gen_random_uuid(),
  menu_id       uuid     references public.menus on delete cascade,
  name          text     not null,
  icon          text,
  display_order integer  default 0
);

-- ────────────────────────────────────────
-- dishes
-- ────────────────────────────────────────
create table public.dishes (
  id            uuid        primary key default gen_random_uuid(),
  category_id   uuid        references public.categories on delete cascade,
  name          text        not null,
  name_hi       text,
  name_ta       text,
  description   text,
  price         numeric     not null,
  is_veg        boolean     default true,
  has_egg       boolean     default false,
  spice_level   integer     default 0,
  is_available  boolean     default true,
  photo_url     text,
  model_3d_url  text,
  is_featured   boolean     default false,
  display_order integer     default 0,
  created_at    timestamptz default now()
);

-- ────────────────────────────────────────
-- tables
-- ────────────────────────────────────────
create table public.tables (
  id            uuid     primary key default gen_random_uuid(),
  restaurant_id uuid     references public.restaurants on delete cascade,
  number        text     not null,
  qr_code_url   text,
  is_active     boolean  default true
);

-- ────────────────────────────────────────
-- orders
-- ────────────────────────────────────────
create table public.orders (
  id                  uuid        primary key default gen_random_uuid(),
  restaurant_id       uuid        references public.restaurants,
  table_id            uuid        references public.tables,
  status              text        default 'pending',
  subtotal            numeric     default 0,
  cgst_amount         numeric     default 0,
  sgst_amount         numeric     default 0,
  total               numeric     default 0,
  payment_method      text,
  payment_status      text        default 'pending',
  razorpay_order_id   text,
  guest_phone         text,
  token_number        integer,
  created_at          timestamptz default now()
);

-- ────────────────────────────────────────
-- order_items
-- ────────────────────────────────────────
create table public.order_items (
  id              uuid    primary key default gen_random_uuid(),
  order_id        uuid    references public.orders on delete cascade,
  dish_id         uuid    references public.dishes,
  quantity        integer not null,
  price           numeric not null,
  customisations  text
);

-- ────────────────────────────────────────
-- staff
-- ────────────────────────────────────────
create table public.staff (
  id            uuid        primary key default gen_random_uuid(),
  restaurant_id uuid        references public.restaurants on delete cascade,
  name          text        not null,
  role          text        not null,
  phone         text,
  pin           text        not null,
  is_active     boolean     default true,
  created_at    timestamptz default now()
);

-- ────────────────────────────────────────
-- loyalty_points
-- ────────────────────────────────────────
create table public.loyalty_points (
  id            uuid        primary key default gen_random_uuid(),
  restaurant_id uuid        references public.restaurants,
  phone         text        not null,
  points        integer     default 0,
  tier          text        default 'bronze',
  created_at    timestamptz default now()
);

-- ────────────────────────────────────────
-- analytics_events
-- ────────────────────────────────────────
create table public.analytics_events (
  id            uuid        primary key default gen_random_uuid(),
  restaurant_id uuid        references public.restaurants,
  event_type    text        not null,
  dish_id       uuid,
  table_id      uuid,
  created_at    timestamptz default now()
);

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.restaurants      enable row level security;
alter table public.menus            enable row level security;
alter table public.categories       enable row level security;
alter table public.dishes           enable row level security;
alter table public.tables           enable row level security;
alter table public.orders           enable row level security;
alter table public.order_items      enable row level security;
alter table public.staff            enable row level security;
alter table public.loyalty_points   enable row level security;
alter table public.analytics_events enable row level security;
