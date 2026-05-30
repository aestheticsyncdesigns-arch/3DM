import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'delivered'

export function useOrderStatus(orderId: string, initialStatus: OrderStatus = 'pending'): OrderStatus {
  const [status, setStatus] = useState<OrderStatus>(initialStatus)

  // Reset to the initial status whenever we start tracking a new order
  useEffect(() => {
    setStatus(initialStatus)
  }, [orderId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!orderId) return

    const channel = supabase
      .channel(`order-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          setStatus(payload.new.status as OrderStatus)
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [orderId])

  return status
}
