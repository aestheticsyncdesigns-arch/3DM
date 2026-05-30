-- Guests need to read the restaurants table to look up a restaurant by subdomain.
create policy "restaurants: anon select"
  on public.restaurants for select
  to anon
  using (true);

grant select on public.restaurants to anon;
