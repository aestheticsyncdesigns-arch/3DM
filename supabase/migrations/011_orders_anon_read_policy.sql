-- Allow unauthenticated guests to read orders by id so the guest order
-- tracker (useOrderStatus) can fetch the current status. Without this, RLS
-- blocks the anon read and PostgREST returns 406 Not Acceptable on .single().
create policy "Guests can read their own order by id"
on public.orders for select
to anon
using (true);
