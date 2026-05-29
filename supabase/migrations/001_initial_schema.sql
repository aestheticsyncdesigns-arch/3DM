-- ============================================================
-- 3DM — Initial Schema
-- Run this in the Supabase SQL Editor to create all core tables.
-- ============================================================

create extension if not exists "uuid-ossp";

-- ────────────────────────────────────────
-- restaurants
-- ────────────────────────────────────────
create table public.restaurants (
  id           uuid        primary key default uuid_generate_v4(),
  name         text        not null,
  subdomain    text        not null unique,
  gstin        text,
  logo         text,
  address      text,
  plan         text        not null default 'starter',
  settings     jsonb       not null default '{}',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ────────────────────────────────────────
-- menus
-- ────────────────────────────────────────
create table public.menus (
  id            uuid        primary key default uuid_generate_v4(),
  restaurant_id uuid        not null references public.restaurants(id) on delete cascade,
  name          text        not null,
  type          text        not null default 'regular',
  schedule      jsonb,
  is_active     boolean     not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ────────────────────────────────────────
-- categories
-- ────────────────────────────────────────
create table public.categories (
  id            uuid        primary key default uuid_generate_v4(),
  menu_id       uuid        not null references public.menus(id) on delete cascade,
  name          text        not null,
  display_order integer     not null default 0,
  created_at    timestamptz not null default now()
);

-- ────────────────────────────────────────
-- dishes
-- ────────────────────────────────────────
create table public.dishes (
  id            uuid        primary key default uuid_generate_v4(),
  category_id   uuid        not null references public.categories(id) on delete cascade,
  name          text        not null,
  description   text,
  price         numeric(10,2) not null,
  is_veg        boolean     not null default true,
  spice_level   text        check (spice_level in ('mild', 'medium', 'spicy', 'extra_hot')),
  is_available  boolean     not null default true,
  model_3d_url  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ────────────────────────────────────────
-- tables  (restaurant seating)
-- ────────────────────────────────────────
create table public.tables (
  id            uuid        primary key default uuid_generate_v4(),
  restaurant_id uuid        not null references public.restaurants(id) on delete cascade,
  number        text        not null,
  qr_code_url   text,
  is_active     boolean     not null default true,
  created_at    timestamptz not null default now()
);

-- ────────────────────────────────────────
-- orders
-- ────────────────────────────────────────
create table public.orders (
  id             uuid          primary key default uuid_generate_v4(),
  restaurant_id  uuid          not null references public.restaurants(id) on delete cascade,
  table_id       uuid          references public.tables(id),
  status         text          not null default 'pending'
                               check (status in ('pending','confirmed','preparing','ready','completed','cancelled')),
  total          numeric(10,2) not null default 0,
  gst_amount     numeric(10,2) not null default 0,
  payment_method text          check (payment_method in ('upi','card','wallet','cash')),
  payment_status text          not null default 'unpaid'
                               check (payment_status in ('unpaid','paid','refunded')),
  created_at     timestamptz   not null default now(),
  updated_at     timestamptz   not null default now()
);

-- ────────────────────────────────────────
-- order_items
-- ────────────────────────────────────────
create table public.order_items (
  id              uuid          primary key default uuid_generate_v4(),
  order_id        uuid          not null references public.orders(id) on delete cascade,
  dish_id         uuid          not null references public.dishes(id),
  quantity        integer       not null default 1,
  price           numeric(10,2) not null,
  customizations  jsonb         not null default '{}',
  created_at      timestamptz   not null default now()
);

-- ────────────────────────────────────────
-- staff
-- ────────────────────────────────────────
create table public.staff (
  id            uuid        primary key default uuid_generate_v4(),
  restaurant_id uuid        not null references public.restaurants(id) on delete cascade,
  name          text        not null,
  role          text        not null check (role in ('admin','manager','waiter','chef')),
  phone         text,
  pin           text        not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ────────────────────────────────────────
-- inventory
-- ────────────────────────────────────────
create table public.inventory (
  id            uuid           primary key default uuid_generate_v4(),
  restaurant_id uuid           not null references public.restaurants(id) on delete cascade,
  item_name     text           not null,
  quantity      numeric(10,3)  not null default 0,
  unit          text           not null,
  reorder_level numeric(10,3)  not null default 0,
  created_at    timestamptz    not null default now(),
  updated_at    timestamptz    not null default now()
);

-- ────────────────────────────────────────
-- analytics_events
-- ────────────────────────────────────────
create table public.analytics_events (
  id            uuid        primary key default uuid_generate_v4(),
  restaurant_id uuid        not null references public.restaurants(id) on delete cascade,
  event_type    text        not null,
  dish_id       uuid        references public.dishes(id),
  table_id      uuid        references public.tables(id),
  metadata      jsonb       not null default '{}',
  created_at    timestamptz not null default now()
);

-- ============================================================
-- Indexes
-- ============================================================
create index on public.menus            (restaurant_id);
create index on public.categories       (menu_id);
create index on public.dishes           (category_id);
create index on public.dishes           (is_available);
create index on public.tables           (restaurant_id);
create index on public.orders           (restaurant_id);
create index on public.orders           (table_id);
create index on public.orders           (status);
create index on public.orders           (created_at desc);
create index on public.order_items      (order_id);
create index on public.staff            (restaurant_id);
create index on public.inventory        (restaurant_id);
create index on public.analytics_events (restaurant_id);
create index on public.analytics_events (created_at desc);
create index on public.analytics_events (event_type);

-- ============================================================
-- updated_at auto-trigger
-- ============================================================
create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at before update on public.restaurants
  for each row execute function public.handle_updated_at();

create trigger set_updated_at before update on public.menus
  for each row execute function public.handle_updated_at();

create trigger set_updated_at before update on public.dishes
  for each row execute function public.handle_updated_at();

create trigger set_updated_at before update on public.orders
  for each row execute function public.handle_updated_at();

create trigger set_updated_at before update on public.staff
  for each row execute function public.handle_updated_at();

create trigger set_updated_at before update on public.inventory
  for each row execute function public.handle_updated_at();

-- ============================================================
-- Row Level Security  (all tables locked — policies added per feature)
-- ============================================================
alter table public.restaurants     enable row level security;
alter table public.menus           enable row level security;
alter table public.categories      enable row level security;
alter table public.dishes          enable row level security;
alter table public.tables          enable row level security;
alter table public.orders          enable row level security;
alter table public.order_items     enable row level security;
alter table public.staff           enable row level security;
alter table public.inventory       enable row level security;
alter table public.analytics_events enable row level security;
