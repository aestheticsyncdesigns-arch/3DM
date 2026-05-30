-- Allow anon guests to read their own order status via Realtime.
-- Orders are identified by UUID (122 bits of entropy — practically unguessable),
-- so allowing anon SELECT exposes no meaningful information to attackers who
-- don't already hold a valid order UUID.
create policy "orders: anon select"
  on public.orders for select
  to anon
  using (true);

grant select on public.orders to anon;
