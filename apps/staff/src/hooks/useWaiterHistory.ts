import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export type DateRange = 'today' | 'week' | 'all'

export interface HistoryOrderItem {
  quantity: number
  dishName: string
}

export interface HistoryOrder {
  id: string
  tableId: string | null
  tokenNumber: number | null
  status: string | null
  total: number | null
  createdAt: string
  paymentStatus: string | null
  paymentMethod: string | null
  items: HistoryOrderItem[]
}

function rangeStart(range: DateRange): string | null {
  if (range === 'all') return null
  const d = new Date()
  if (range === 'today') {
    d.setHours(0, 0, 0, 0)
    return d.toISOString()
  }
  // Monday 00:00 of the current week
  const day = d.getDay() // 0 = Sun
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day))
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export function useWaiterHistory(
  restaurantId: string | undefined,
  staffId: string | undefined,
  range: DateRange,
) {
  return useQuery<HistoryOrder[]>({
    queryKey: ['waiter-history', restaurantId, staffId, range],
    queryFn: async () => {
      if (!restaurantId || !staffId) return []

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query: any = supabase
        .from('orders')
        .select(`
          id,
          table_id,
          token_number,
          status,
          total,
          created_at,
          payment_status,
          payment_method,
          order_items (
            quantity,
            dishes ( name )
          )
        `)
        .eq('restaurant_id', restaurantId)
        .eq('taken_by', staffId)
        .order('created_at', { ascending: false })

      const start = rangeStart(range)
      if (start) query = query.gte('created_at', start)

      const { data, error } = await query
      if (error) throw error

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data ?? []).map((o: any) => ({
        id: o.id,
        tableId: o.table_id,
        tokenNumber: o.token_number,
        status: o.status,
        total: o.total != null ? Number(o.total) : null,
        createdAt: o.created_at,
        paymentStatus: o.payment_status,
        paymentMethod: o.payment_method,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        items: (o.order_items ?? []).map((item: any) => ({
          quantity: item.quantity,
          dishName: item.dishes?.name ?? 'Unknown',
        })),
      }))
    },
    enabled: !!restaurantId && !!staffId,
    staleTime: 30_000,
  })
}
