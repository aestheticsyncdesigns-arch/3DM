import { useState } from 'react'
import { useCart } from '../context/CartContext'
import type { CartItem } from '../context/CartContext'
import CartDrawer from './CartDrawer'
import OrderConfirmation from './OrderConfirmation'
import type { PlacedOrder } from '../hooks/usePlaceOrder'
import { useOrderStatus } from '../hooks/useOrderStatus'
import type { OrderStatus } from '../hooks/useOrderStatus'

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending:   'Order Received',
  preparing: 'Being Prepared',
  ready:     'Ready for Pickup!',
  delivered: 'Served',
}

export default function CartBar() {
  const { itemCount, total, clearCart } = useCart()
  const [drawerOpen, setDrawerOpen]       = useState(false)
  const [confirmedOrder, setConfirmedOrder] = useState<PlacedOrder | null>(null)
  const [confirmedItems, setConfirmedItems] = useState<CartItem[]>([])
  const [overlayOpen, setOverlayOpen]     = useState(false)

  const liveStatus = useOrderStatus(
    confirmedOrder?.id ?? '',
    (confirmedOrder?.status ?? 'pending') as OrderStatus,
  )

  function handleOrderSuccess(order: PlacedOrder, items: CartItem[]) {
    clearCart()                 // safe now — confirmedOrder keeps CartBar mounted
    setConfirmedOrder(order)
    setConfirmedItems(items)
    setDrawerOpen(false)
    setOverlayOpen(true)
  }

  function handleCloseOverlay() {
    setOverlayOpen(false)       // back to menu; pill takes over
  }

  function handleFullDismiss() {
    setConfirmedOrder(null)
    setConfirmedItems([])
    setOverlayOpen(false)
  }

  if (itemCount === 0 && !confirmedOrder) return null

  return (
    <>
      {/* Orange "View Cart" bar — only when items in cart and no active confirmed order */}
      {itemCount > 0 && !confirmedOrder && (
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
      )}

      {/* Floating status pill — visible when order is active but overlay is closed */}
      {confirmedOrder && !overlayOpen && (
        <div
          role="button"
          tabIndex={0}
          aria-label={`Order #${confirmedOrder.token_number} — tap to view status`}
          onClick={() => setOverlayOpen(true)}
          onKeyDown={(e) => e.key === 'Enter' && setOverlayOpen(true)}
          className={[
            'fixed left-1/2 top-4 z-50 -translate-x-1/2 cursor-pointer rounded-full px-4 py-2 shadow-lg transition-colors duration-300',
            liveStatus === 'ready' ? 'bg-green-500' : 'bg-[#FF5722]',
          ].join(' ')}
        >
          <p className="whitespace-nowrap text-sm font-bold text-white">
            Order #{confirmedOrder.token_number} — {STATUS_LABELS[liveStatus]}
          </p>
        </div>
      )}

      <CartDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onOrderSuccess={handleOrderSuccess}
      />

      {confirmedOrder && overlayOpen && (
        <OrderConfirmation
          order={confirmedOrder}
          items={confirmedItems}
          status={liveStatus}
          onClose={handleCloseOverlay}
          onDismiss={handleFullDismiss}
        />
      )}
    </>
  )
}
