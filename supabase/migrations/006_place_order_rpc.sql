-- Atomic order placement callable by anon guests.
-- security definer lets it count + insert orders without anon SELECT on the orders table.
create or replace function public.place_order(
  p_restaurant_id uuid,
  p_table_id      uuid,
  p_guest_phone   text,
  p_subtotal      numeric,
  p_cgst_amount   numeric,
  p_sgst_amount   numeric,
  p_total         numeric,
  p_items         jsonb   -- [{dish_id, quantity, price}]
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token int;
  v_order_id uuid;
  v_item jsonb;
begin
  -- Token = count of today's orders for this restaurant + 1
  select coalesce(count(*)::int, 0) + 1
  into v_token
  from public.orders
  where restaurant_id = p_restaurant_id
    and created_at >= current_date::timestamptz;

  v_order_id := gen_random_uuid();

  insert into public.orders (
    id, restaurant_id, table_id, status,
    subtotal, cgst_amount, sgst_amount, total,
    guest_phone, token_number
  ) values (
    v_order_id, p_restaurant_id, p_table_id, 'pending',
    p_subtotal, p_cgst_amount, p_sgst_amount, p_total,
    p_guest_phone, v_token
  );

  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into public.order_items (order_id, dish_id, quantity, price)
    values (
      v_order_id,
      (v_item->>'dish_id')::uuid,
      (v_item->>'quantity')::int,
      (v_item->>'price')::numeric
    );
  end loop;

  return jsonb_build_object(
    'id',           v_order_id,
    'token_number', v_token,
    'restaurant_id', p_restaurant_id,
    'table_id',     p_table_id,
    'status',       'pending',
    'subtotal',     p_subtotal,
    'cgst_amount',  p_cgst_amount,
    'sgst_amount',  p_sgst_amount,
    'total',        p_total,
    'guest_phone',  p_guest_phone
  );
end;
$$;

grant execute on function public.place_order to anon;
