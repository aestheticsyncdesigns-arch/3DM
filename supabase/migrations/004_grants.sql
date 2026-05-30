-- ============================================================
-- 3DM — Table-level GRANT permissions
-- Run this in the Supabase SQL Editor after 003_rls_policies.sql.
-- RLS policies control which rows; GRANTs control table access.
-- ============================================================

grant usage on schema public to anon, authenticated;

-- anon (guests): read menu data, place orders, log events
grant select          on public.menus             to anon;
grant select          on public.categories        to anon;
grant select          on public.dishes            to anon;
grant select          on public.tables            to anon;
grant insert          on public.orders            to anon;
grant insert          on public.order_items       to anon;
grant insert          on public.analytics_events  to anon;

-- authenticated (restaurant owners / staff): full control over their data
grant all             on public.restaurants       to authenticated;
grant all             on public.menus             to authenticated;
grant all             on public.categories        to authenticated;
grant all             on public.dishes            to authenticated;
grant all             on public.tables            to authenticated;
grant all             on public.staff             to authenticated;
grant all             on public.loyalty_points    to authenticated;
grant select, update  on public.orders            to authenticated;
grant select, update  on public.order_items       to authenticated;
grant select          on public.analytics_events  to authenticated;
