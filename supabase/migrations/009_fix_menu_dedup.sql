-- ============================================================
-- Migration 009 — Fix duplicate menus
-- Run in Supabase SQL Editor.
-- ============================================================

-- 1. Delete empty duplicate menus, keeping only those that have categories.
--    If multiple menus have categories, keep the oldest one.
delete from public.menus
where id in (
  select m.id
  from public.menus m
  left join public.categories c on c.menu_id = m.id
  where c.id is null  -- no categories attached
    and exists (
      -- another menu for the same restaurant already has categories
      select 1 from public.menus m2
      join public.categories c2 on c2.menu_id = m2.id
      where m2.restaurant_id = m.restaurant_id
    )
);

-- 2. For restaurants that still have duplicate menus (all empty),
--    keep only the oldest one.
delete from public.menus
where id in (
  select id from (
    select id,
           row_number() over (partition by restaurant_id order by created_at asc) as rn
    from public.menus
  ) ranked
  where rn > 1
);

-- 3. Drop the old auto-create trigger if it exists (was likely created via
--    Supabase dashboard, not captured in migration files).
drop trigger if exists create_default_menu_on_restaurant_insert on public.restaurants;
drop function if exists public.create_default_menu();

-- 4. Recreate the function with an idempotency check — only inserts if
--    no menu already exists for this restaurant.
create or replace function public.create_default_menu()
returns trigger language plpgsql security definer as $$
begin
  if not exists (
    select 1 from public.menus where restaurant_id = new.id
  ) then
    insert into public.menus (restaurant_id, name, is_active)
    values (new.id, 'Main Menu', true);
  end if;
  return new;
end;
$$;

-- 5. Re-attach the trigger.
create trigger create_default_menu_on_restaurant_insert
  after insert on public.restaurants
  for each row execute function public.create_default_menu();
