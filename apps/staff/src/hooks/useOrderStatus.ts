import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'delivered'

/**
 * Live order status via Supabase Realtime — same pattern as the guest app.
 * Fetches the current status on mount, then subscribes to UPDATE events on the
 * orders table filtered by this order id. Unsubscribes on unmount.
 */
export function useOrderStatus(orderId: string, initialStatus: OrderStatus = 'pending'): OrderStatus {
  const [status, setStatus] = useState<OrderStatus>(initialStatus)

  useEffect(() => {
    if (!orderId) return

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

    const channel = supabase
      .channel(`order-status-${orderId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'orders',
        filter: `id=eq.${orderId}`,
      }, (payload) => {
        setStatus((payload.new as { status: OrderStatus }).status)
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [orderId])

  return status
}
