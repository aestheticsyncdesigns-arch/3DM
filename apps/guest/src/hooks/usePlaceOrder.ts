import { useState } from 'react'
import { supabase } from '../lib/supabase'
import type { CartItem } from '../context/CartContext'

export interface PlacedOrder {
  id: string
  token_number: number
  restaurant_id: string
  table_id: string | null
  status: string
  subtotal: number
  cgst_amount: number
  sgst_amount: number
  total: number
  guest_phone: string | null
}

interface PlaceOrderArgs {
  restaurantId: string
  tableId: string | null
  items: CartItem[]
  guestPhone?: string
}

export function usePlaceOrder() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function placeOrder({
    restaurantId,
    tableId,
    items,
    guestPhone,
  }: PlaceOrderArgs): Promise<PlacedOrder | null> {
    setIsLoading(true)
    setError(null)

    try {
      const subtotal = items.reduce((s, i) => s + i.dish.price * i.quantity, 0)
      const gst = Math.round(subtotal * 0.05)
      const cgstAmount = Math.floor(gst / 2)
      const sgstAmount = gst - cgstAmount
      const total = subtotal + gst

      // @ts-expect-error — place_order RPC exists at runtime; types not generated
      const { data, error: rpcError } = await supabase.rpc('place_order', {
        p_restaurant_id: restaurantId,
        p_table_id: tableId,
        p_guest_phone: guestPhone || null,
        p_subtotal: subtotal,
        p_cgst_amount: cgstAmount,
        p_sgst_amount: sgstAmount,
        p_total: total,
        p_items: items.map((i) => ({
          dish_id: i.dish.id,
          quantity: i.quantity,
          price: i.dish.price,
        })),
      })

      if (rpcError) throw new Error(rpcError.message)

      return data as unknown as PlacedOrder
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to place order'
      setError(msg)
      return null
    } finally {
      setIsLoading(false)
    }
  }

  return { placeOrder, isLoading, error }
}
