import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export interface WaiterStats {
  ordersTaken: number
  paymentsCollected: number
  revenueCollected: number
}

function startOfTodayISO(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

/**
 * Today's performance for one staff member:
 *   • ordersTaken        — orders this person placed (orders.taken_by)
 *   • paymentsCollected  — payments this person recorded (orders.paid_by)
 *   • revenueCollected   — ₹ total of those payments
 * Refetches every 30s so the Profile tab stays roughly live.
 */
export function useWaiterStats(restaurantId: string | undefined, staffId: string | undefined) {
  return useQuery<WaiterStats>({
    queryKey: ['waiter-stats', restaurantId, staffId],
    queryFn: async () => {
      const empty: WaiterStats = { ordersTaken: 0, paymentsCollected: 0, revenueCollected: 0 }
      if (!restaurantId || !staffId) return empty
      const today = startOfTodayISO()

      const [takenRes, paidRes] = await Promise.all([
        supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('restaurant_id', restaurantId)
          .eq('taken_by', staffId)
          .gte('created_at', today),
        supabase
          .from('orders')
          .select('total')
          .eq('restaurant_id', restaurantId)
          .eq('paid_by', staffId)
          .eq('payment_status', 'paid')
          .gte('paid_at', today),
      ])

      const payments = paidRes.data ?? []
      return {
        ordersTaken: takenRes.count ?? 0,
        paymentsCollected: payments.length,
        revenueCollected: payments.reduce((s, o) => s + (Number(o.total) || 0), 0),
      }
    },
    enabled: !!restaurantId && !!staffId,
    staleTime: 15_000,
    refetchInterval: 30_000,
  })
}
