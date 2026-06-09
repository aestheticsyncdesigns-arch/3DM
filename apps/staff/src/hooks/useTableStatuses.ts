import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export type TableState = 'free' | 'occupied' | 'awaiting_payment'

export interface TableStatusInfo {
  state: TableState
  activeCount: number
  unpaidCount: number
}

const ACTIVE = ['pending', 'preparing', 'ready']

function startOfTodayISO(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

/**
 * A per-table status map for the Tables tab. A table is:
 *   • occupied          — has an order still pending/cooking/ready
 *   • awaiting_payment  — all orders served but at least one is unpaid
 *   • free              — nothing outstanding
 * Recomputes live whenever any order for the restaurant changes.
 */
export function useTableStatuses(restaurantId: string | undefined) {
  const queryClient = useQueryClient()
  const queryKey = ['table-statuses', restaurantId]

  const query = useQuery<Record<string, TableStatusInfo>>({
    queryKey,
    queryFn: async () => {
      if (!restaurantId) return {}
      // Today's orders cover the full active + just-served lifecycle.
      const { data, error } = await supabase
        .from('orders')
        .select('table_id, status, payment_status, created_at')
        .eq('restaurant_id', restaurantId)
        .gte('created_at', startOfTodayISO())

      if (error) throw error

      const map: Record<string, TableStatusInfo> = {}
      for (const o of data ?? []) {
        if (!o.table_id) continue
        const info = (map[o.table_id] ??= { state: 'free', activeCount: 0, unpaidCount: 0 })
        if (o.status && ACTIVE.includes(o.status)) info.activeCount++
        else if (o.status === 'delivered' && o.payment_status !== 'paid') info.unpaidCount++
      }
      for (const id of Object.keys(map)) {
        const info = map[id]
        info.state = info.activeCount > 0 ? 'occupied' : info.unpaidCount > 0 ? 'awaiting_payment' : 'free'
      }
      return map
    },
    enabled: !!restaurantId,
  })

  useEffect(() => {
    if (!restaurantId) return
    const channel = supabase
      .channel(`table-statuses-${restaurantId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` },
        () => { void queryClient.invalidateQueries({ queryKey }) },
      )
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId])

  return query
}
