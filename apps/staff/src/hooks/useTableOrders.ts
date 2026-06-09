import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export interface TableOrderItem {
  name: string
  quantity: number
  notes: string | null
}

export interface TableOrder {
  id: string
  token_number: number | null
  status: string | null
  created_at: string | null
  items: TableOrderItem[]
}

// Everything still "on the table" — anything not yet served.
const NOT_DELIVERED = ['pending', 'preparing', 'ready']

/**
 * All not-yet-delivered orders for a single table, newest first, with their
 * line items. Refetches live whenever an order for this table changes.
 */
export function useTableOrders(tableId: string | null) {
  const queryClient = useQueryClient()
  const queryKey = ['table-orders', tableId]

  const query = useQuery<TableOrder[]>({
    queryKey,
    queryFn: async () => {
      if (!tableId) return []

      const { data: orderData, error } = await supabase
        .from('orders')
        .select('id, token_number, status, created_at')
        .eq('table_id', tableId)
        .in('status', NOT_DELIVERED)
        .order('created_at', { ascending: false })

      if (error) throw error
      const orders = orderData ?? []
      if (orders.length === 0) return []

      const orderIds = orders.map((o) => o.id)

      const { data: itemData } = await supabase
        .from('order_items')
        .select('order_id, dish_id, quantity, notes')
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

      // Dedupe by id defensively, preserving newest-first order.
      const byId = new Map<string, TableOrder>()
      for (const o of orders) {
        if (byId.has(o.id)) continue
        byId.set(o.id, {
          id: o.id,
          token_number: o.token_number,
          status: o.status,
          created_at: o.created_at,
          items: items
            .filter((i) => i.order_id === o.id)
            .map((i) => ({
              name: (i.dish_id && dishNameById.get(i.dish_id)) || 'Item',
              quantity: i.quantity,
              notes: i.notes ?? null,
            })),
        })
      }
      return Array.from(byId.values())
    },
    enabled: !!tableId,
  })

  // Refetch when any order for this table changes. A plain refetch is safe here
  // because the queryFn dedupes by id — no manual cache appends to race with.
  useEffect(() => {
    if (!tableId) return
    const channel = supabase
      .channel(`table-orders-${tableId}`)
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
