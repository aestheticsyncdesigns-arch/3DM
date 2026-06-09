import { useState } from 'react'
import { useCart } from '../context/CartContext'
import type { CartItem } from '../context/CartContext'
import CartDrawer from './CartDrawer'
import type { PlacedOrder } from '../hooks/usePlaceOrder'

export default function CartBar() {
  const { itemCount, total, clearCart } = useCart()
  const [drawerOpen, setDrawerOpen] = useState(false)

  function handleOrderSuccess(order: PlacedOrder, items: CartItem[]) {
    clearCart()
    setDrawerOpen(false)
    window.dispatchEvent(
      new CustomEvent('3dm:order-placed', { detail: { order, items } }),
    )
  }

  if (itemCount === 0) return null

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        aria-label="View cart"
        onClick={() => setDrawerOpen(true)}
        onKeyDown={(e) => e.key === 'Enter' && setDrawerOpen(true)}
        className="fixed bottom-0 left-0 right-0 z-40 cursor-pointer bg-[#FF5722] px-5 py-3.5 shadow-lg"
      >
        <div className="flex items-center justify-between text-white">
          <span className="flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-white/25 px-1.5 text-sm font-bold">
            {itemCount}
          </span>
          <span className="text-base font-semibold">View Cart</span>
          <span className="text-base font-bold">₹ {total}</span>
        </div>
      </div>

      <CartDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onOrderSuccess={handleOrderSuccess}
      />
    </>
  )
}
