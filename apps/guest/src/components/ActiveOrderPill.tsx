import { useEffect, useState } from 'react'
import { useCart } from '../context/CartContext'
import { useOrderStatus, type OrderStatus } from '../hooks/useOrderStatus'
import OrderConfirmation from './OrderConfirmation'
import type { PlacedOrder } from '../hooks/usePlaceOrder'
import type { CartItem } from '../context/CartContext'

const LS_ID    = 'active_order_id'
const LS_ORDER = 'active_order_data'
const LS_ITEMS = 'active_order_items'

const STATUS_LABELS: Partial<Record<OrderStatus, string>> = {
  pending:   'Order Received',
  preparing: 'Being Prepared',
  ready:     'Ready for Pickup!',
}

function readSavedOrder(): PlacedOrder | null {
  try {
    const raw = localStorage.getItem(LS_ORDER)
    return raw ? (JSON.parse(raw) as PlacedOrder) : null
  } catch { return null }
}

function readSavedItems(): CartItem[] {
  try {
    const raw = localStorage.getItem(LS_ITEMS)
    return raw ? (JSON.parse(raw) as unknown as CartItem[]) : []
  } catch { return [] }
}

function clearStorage() {
  localStorage.removeItem(LS_ID)
  localStorage.removeItem(LS_ORDER)
  localStorage.removeItem(LS_ITEMS)
}

export default function ActiveOrderPill() {
  const { itemCount } = useCart()
  const [order, setOrder]           = useState<PlacedOrder | null>(readSavedOrder)
  const [items, setItems]           = useState<CartItem[]>(readSavedItems)
  const [overlayOpen, setOverlayOpen] = useState(false)

  const liveStatus = useOrderStatus(order?.id ?? '')

  // Listen for new orders placed in the same session (dispatched by CartBar)
  useEffect(() => {
    function handleNewOrder(e: Event) {
      const { order: newOrder, items: newItems } = (
        e as CustomEvent<{ order: PlacedOrder; items: CartItem[] }>
      ).detail
      localStorage.setItem(LS_ID, newOrder.id)
      localStorage.setItem(LS_ORDER, JSON.stringify(newOrder))
      localStorage.setItem(LS_ITEMS, JSON.stringify(newItems))
      setOrder(newOrder)
      setItems(newItems)
      setOverlayOpen(true)
    }
    window.addEventListener('3dm:order-placed', handleNewOrder)
    return () => window.removeEventListener('3dm:order-placed', handleNewOrder)
  }, [])

  // Auto-open the tracker overlay when the order is delivered so the
  // guest sees the "Thank you for dining" screen and the "Done" button.
  useEffect(() => {
    if (liveStatus === 'delivered') {
      setOverlayOpen(true)
    }
  }, [liveStatus])

  if (!order) return null

  const isReady     = liveStatus === 'ready'
  const isDelivered = liveStatus === 'delivered'
  const label       = STATUS_LABELS[liveStatus]

  // Mirror WaiterCallButton: lift above the CartBar when items are in the cart
  const bottomClass = itemCount > 0 ? 'bottom-20' : 'bottom-6'

  function handleDismiss() {
    clearStorage()
    setOrder(null)
    setOverlayOpen(false)
  }

  return (
    <>
      {/* Floating pill — bottom-left, hidden while overlay is open or order is delivered */}
      {!overlayOpen && !isDelivered && (
        <button
          type="button"
          onClick={() => setOverlayOpen(true)}
          aria-label={`Order #${order.token_number} — tap to view status`}
          className={[
            'fixed left-4 z-40 flex items-center rounded-full px-4 py-2.5 shadow-lg transition-all duration-300 active:scale-95',
            bottomClass,
            isReady ? 'animate-pulse bg-green-500' : 'bg-[#FF5722]',
          ].join(' ')}
        >
          <span className="whitespace-nowrap text-sm font-bold text-white">
            Order #{order.token_number} — {label}
          </span>
        </button>
      )}

      {/* Full 4-step tracker overlay */}
      {overlayOpen && (
        <OrderConfirmation
          order={order}
          items={items}
          status={liveStatus}
          onClose={() => setOverlayOpen(false)}
          onDismiss={handleDismiss}
        />
      )}
    </>
  )
}
