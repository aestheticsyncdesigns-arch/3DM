import { useState } from 'react'
import { useCart } from '../context/CartContext'
import type { CartItem } from '../context/CartContext'
import { usePlaceOrder } from '../hooks/usePlaceOrder'
import type { PlacedOrder } from '../hooks/usePlaceOrder'

interface Props {
  open: boolean
  onClose: () => void
  onOrderSuccess: (order: PlacedOrder, items: CartItem[]) => void
}

function Spinner() {
  return (
    <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="4" />
      <path fill="white" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

export default function CartDrawer({ open, onClose, onOrderSuccess }: Props) {
  const { items, updateQuantity, subtotal, gstAmount, total, restaurantId, tableId } = useCart()
  const { placeOrder, isLoading, error } = usePlaceOrder()
  const [phone, setPhone] = useState('')

  async function handlePlaceOrder() {
    if (!restaurantId) return
    const snapshot = [...items]
    const result = await placeOrder({
      restaurantId,
      tableId,
      items: snapshot,
      guestPhone: phone.trim() || undefined,
    })
    if (result) onOrderSuccess(result, snapshot)
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={[
          'fixed inset-0 z-50 bg-black/40 transition-opacity duration-300',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none',
        ].join(' ')}
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        className={[
          'fixed bottom-0 left-0 right-0 z-[60] max-h-[85vh] overflow-y-auto rounded-t-2xl bg-white transition-transform duration-300',
          open ? 'translate-y-0' : 'translate-y-full',
        ].join(' ')}
      >
        {/* Drag handle */}
        <div className="flex justify-center pb-1 pt-3">
          <div className="h-1 w-12 rounded-full bg-gray-200" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h2 className="text-lg font-bold text-gray-900">Your Cart</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close cart"
            className="flex h-7 w-7 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100"
          >
            ✕
          </button>
        </div>

        {/* Item list */}
        <div className="flex flex-col divide-y divide-gray-50 px-4 py-2">
          {items.map((item) => (
            <div key={item.dish.id} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium leading-tight text-gray-900">{item.dish.name}</p>
                <p className="text-xs text-gray-400">₹ {item.dish.price} each</p>
              </div>

              <div className="flex items-center rounded-full border border-[#FF5722]">
                <button
                  type="button"
                  onClick={() => updateQuantity(item.dish.id, item.quantity - 1)}
                  aria-label="Decrease quantity"
                  className="flex h-7 w-7 items-center justify-center text-base font-bold text-[#FF5722]"
                >
                  −
                </button>
                <span className="min-w-[1.25rem] text-center text-sm font-bold text-gray-900">
                  {item.quantity}
                </span>
                <button
                  type="button"
                  onClick={() => updateQuantity(item.dish.id, item.quantity + 1)}
                  aria-label="Increase quantity"
                  className="flex h-7 w-7 items-center justify-center text-base font-bold text-[#FF5722]"
                >
                  +
                </button>
              </div>

              <p className="w-16 text-right text-sm font-semibold text-gray-900">
                ₹ {item.dish.price * item.quantity}
              </p>
            </div>
          ))}
        </div>

        {/* Bill summary */}
        <div className="mx-4 my-2 rounded-xl bg-gray-50 px-4 py-3">
          <div className="flex justify-between py-1 text-sm text-gray-500">
            <span>Subtotal</span>
            <span>₹ {subtotal}</span>
          </div>
          <div className="flex justify-between py-1 text-sm text-gray-500">
            <span>GST (5%)</span>
            <span>₹ {gstAmount}</span>
          </div>
          <div className="mt-1 flex justify-between border-t border-gray-200 pt-2 font-bold text-gray-900">
            <span>Total</span>
            <span>₹ {total}</span>
          </div>
        </div>

        {/* Phone input */}
        <div className="mx-4 mb-2 mt-1">
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Mobile number for WhatsApp bill (optional)"
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-[#FF5722] focus:bg-white"
          />
        </div>

        {/* Error */}
        {error && (
          <p className="mx-4 mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-2 px-4 pb-10 pt-2">
          <button
            type="button"
            onClick={handlePlaceOrder}
            disabled={isLoading || items.length === 0}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF5722] py-3.5 text-base font-bold text-white disabled:opacity-70 active:bg-orange-700"
          >
            {isLoading ? <Spinner /> : null}
            {isLoading ? 'Placing Order…' : 'Place Order'}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="w-full rounded-xl border border-gray-200 py-3 text-sm font-medium text-gray-600 disabled:opacity-50 active:bg-gray-50"
          >
            Continue Browsing
          </button>
        </div>
      </div>
    </>
  )
}
