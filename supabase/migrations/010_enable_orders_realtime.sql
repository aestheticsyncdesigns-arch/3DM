-- Enable Realtime for the orders table so the guest order tracker
-- receives live status updates without polling.
alter publication supabase_realtime add table public.orders;
