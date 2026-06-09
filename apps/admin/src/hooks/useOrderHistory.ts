import { useQuery } from '@tanstack/react-query'
import { supabase } from '../supabase'

export interface HistoryItem {
  dish_id: string | null
  quantity: number
  price: number
  notes: string | null
}

export interface HistoryOrder {
  id: string
  token_number: number | null
  table_id: string | null
  status: string | null
  subtotal: number | null
  cgst_amount: number | null
  sgst_amount: number | null
  total: number | null
  payment_status: string | null
  payment_method: string | null
  created_at: string | null
  order_items: HistoryItem[]
}

/**
 * All orders for a restaurant within [fromISO, toISO], newest first, with line
 * items for the expandable detail view. The date window is server-side; status /
 * payment / search filtering happens client-side so it's instant.
 */
export function useOrderHistory(
  restaurantId: string | undefined,
  fromISO: string,
  toISO: string,
) {
  return useQuery<HistoryOrder[]>({
    queryKey: ['order-history', restaurantId, fromISO, toISO],
    queryFn: async () => {
      if (!restaurantId) return []
      const { data, error } = await supabase
        .from('orders')
        .select(
          'id, token_number, table_id, status, subtotal, cgst_amount, sgst_amount, total, payment_status, payment_method, created_at, order_items(dish_id, quantity, price, notes)',
        )
        .eq('restaurant_id', restaurantId)
        .gte('created_at', fromISO)
        .lte('created_at', toISO)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as HistoryOrder[]
    },
    enabled: !!restaurantId,
    staleTime: 30_000,
  })
}
