import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export interface UnpaidOrderItem {
  name: string
  quantity: number
  price: number
}

export interface UnpaidOrder {
  id: string
  token_number: number | null
  subtotal: number | null
  cgst_amount: number | null
  sgst_amount: number | null
  total: number | null
  items: UnpaidOrderItem[]
}

/**
 * Delivered-but-not-yet-paid orders for a single table, newest first, with their
 * line items + tax breakdown. This is what the waiter collects payment against.
 * Refetches live whenever an order for this table changes (e.g. the moment an
 * order is marked served, or once payment is recorded it drops off the list).
 */
export function useUnpaidOrders(tableId: string | null) {
  const queryClient = useQueryClient()
  const queryKey = ['unpaid-orders', tableId]

  const query = useQuery<UnpaidOrder[]>({
    queryKey,
    queryFn: async () => {
      if (!tableId) return []

      const { data: orderData, error } = await supabase
        .from('orders')
        .select('id, token_number, subtotal, cgst_amount, sgst_amount, total, payment_status')
        .eq('table_id', tableId)
        .eq('status', 'delivered')
        .order('created_at', { ascending: false })

      if (error) throw error
      // Anything not explicitly 'paid' is still owed (unpaid / failed / null).
      const orders = (orderData ?? []).filter((o) => o.payment_status !== 'paid')
      if (orders.length === 0) return []

      const orderIds = orders.map((o) => o.id)

      const { data: itemData } = await supabase
        .from('order_items')
        .select('order_id, dish_id, quantity, price')
        .in('order_id', orderIds)

      const items = itemData ?? []
      const dishIds = [...new Set(items.map((i) => i.dish_id).filter(Boolean))] as string[]

      const dishNameById = new Map<string, string>()
      if (dishIds.length > 0) {
        const { data: dishData } = await supabase
          .from('dishes')
          .select('id, name')
          .in('id', dishIds)
        for (const d of dishData ?? []) dishNameById.set(d.id, d.name)
      }

      const byId = new Map<string, UnpaidOrder>()
      for (const o of orders) {
        if (byId.has(o.id)) continue
        byId.set(o.id, {
          id: o.id,
          token_number: o.token_number,
          subtotal: o.subtotal,
          cgst_amount: o.cgst_amount,
          sgst_amount: o.sgst_amount,
          total: o.total,
          items: items
            .filter((i) => i.order_id === o.id)
            .map((i) => ({
              name: (i.dish_id && dishNameById.get(i.dish_id)) || 'Item',
              quantity: i.quantity,
              price: i.price,
            })),
        })
      }
      return Array.from(byId.values())
    },
    enabled: !!tableId,
  })

  // Refetch when any order for this table changes — the queryFn dedupes by id.
  useEffect(() => {
    if (!tableId) return
    const channel = supabase
      .channel(`unpaid-orders-${tableId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `table_id=eq.${tableId}` },
        () => {
          void queryClient.invalidateQueries({ queryKey })
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId])

  return query
}
