import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'delivered'

export function useOrderStatus(orderId: string, initialStatus: OrderStatus = 'pending'): OrderStatus {
  const [status, setStatus] = useState<OrderStatus>(initialStatus)

  useEffect(() => {
    if (!orderId) return

    // Fetch current status immediately — covers the case where the status
    // changed while the overlay was closed or before the subscription started.
    // Select only `status`, filter by id. Handle a missing order gracefully
    // (e.g. a stale active_order_id in localStorage) without throwing.
    supabase
      .from('orders')
      .select('status')
      .eq('id', orderId)
      .single()
      .then(({ data, error }) => {
        if (error) {
          console.warn('[useOrderStatus] could not fetch order status:', error.message)
          return
        }
        if (data?.status) setStatus(data.status as OrderStatus)
      })

    // Subscribe to live UPDATE events for this specific order.
    const channel = supabase
      .channel(`order-status-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          // TEMP DEBUG — confirm realtime events are arriving in the browser
          console.log('[useOrderStatus] realtime UPDATE received:', payload)
          setStatus(payload.new.status as OrderStatus)
        },
      )
      .subscribe((subStatus) => {
        // TEMP DEBUG — confirm the channel actually connects. Expect 'SUBSCRIBED'.
        // If you see 'CHANNEL_ERROR'/'TIMED_OUT', Realtime is not enabled for the
        // orders table — run migration 010 in the Supabase SQL editor.
        console.log(`[useOrderStatus] channel order-status-${orderId} status:`, subStatus)
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [orderId])

  return status
}
