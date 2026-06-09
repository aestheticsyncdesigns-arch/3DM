import { useState } from 'react'
import { downloadBill } from '../lib/bill'
import type { PlacedOrder } from '../hooks/usePlaceOrder'
import type { CartItem } from '../context/CartContext'
import type { OrderStatus } from '../hooks/useOrderStatus'

interface Props {
  order: PlacedOrder
  items: CartItem[]
  status: OrderStatus
  onClose: () => void    // back to menu — keeps tracking active
  onDismiss: () => void  // final dismiss — only shown when delivered
}

const STEPS: { status: OrderStatus; label: string; sub: string }[] = [
  { status: 'pending',   label: 'Order Received',    sub: 'Waiting for restaurant to confirm' },
  { status: 'preparing', label: 'Being Prepared',    sub: 'Your food is being cooked' },
  { status: 'ready',     label: 'Ready for Pickup',  sub: 'Please collect from the counter' },
  { status: 'delivered', label: 'Served',             sub: 'Enjoy your meal!' },
]

const STATUS_ORDER: OrderStatus[] = ['pending', 'preparing', 'ready', 'delivered']

export default function OrderConfirmation({ order, items, status, onClose, onDismiss }: Props) {
  const currentIdx = STATUS_ORDER.indexOf(status)
  const isReady = status === 'ready'
  const isDelivered = status === 'delivered'

  const [billBusy, setBillBusy]   = useState(false)
  const [billError, setBillError] = useState<string | null>(null)

  async function handleDownloadBill() {
    setBillBusy(true)
    setBillError(null)
    try {
      await downloadBill(order.id)
    } catch (e) {
      setBillError(e instanceof Error ? e.message : 'Could not generate the bill')
    } finally {
      setBillBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex flex-col overflow-y-auto bg-gray-900 px-6 py-10">
      <div className="mx-auto flex w-full max-w-sm flex-col items-center">

        {/* Header */}
        {isDelivered ? (
          <div className="mb-5 text-center">
            <p className="mb-1 text-4xl">🙏</p>
            <h1 className="text-2xl font-black text-white">Thank you for dining with us</h1>
            <p className="mt-1 text-sm text-gray-400">We hope to see you again soon</p>
          </div>
        ) : isReady ? (
          <div className="mb-5 text-center">
            <p className="mb-1 text-4xl">🎉</p>
            <h1 className="text-2xl font-black text-white">Your order is ready!</h1>
            <p className="mt-1 text-sm text-gray-400">Please collect from the counter</p>
          </div>
        ) : (
          <div className="mb-5 flex flex-col items-center text-center">
            <div className="mb-3 flex h-20 w-20 items-center justify-center rounded-full bg-green-500 shadow-lg shadow-green-500/40">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h1 className="text-2xl font-black text-white">Order Placed!</h1>
            <p className="mt-1 text-sm text-gray-400">Your order is being prepared</p>
          </div>
        )}

        {/* Token number */}
        <div className={[
          'relative mb-6 w-full overflow-hidden rounded-2xl border py-5 text-center transition-all duration-500',
          isReady
            ? 'border-green-500/50 bg-green-500/10 shadow-xl shadow-green-500/20'
            : 'border-[#FF5722]/30 bg-[#FF5722]/10',
        ].join(' ')}>
          {isReady && (
            <span className="absolute inset-0 animate-ping rounded-2xl bg-green-400/10" />
          )}
          <p className="text-xs font-medium uppercase tracking-widest text-gray-400">Your Token</p>
          <p className={[
            'text-6xl font-black transition-colors duration-500',
            isReady ? 'animate-bounce text-green-400' : isDelivered ? 'text-gray-400' : 'text-[#FF5722]',
          ].join(' ')}>
            #{order.token_number}
          </p>
        </div>

        {/* Status timeline */}
        <div className="mb-6 w-full">
          {STEPS.map((step, idx) => {
            const isPast    = idx < currentIdx
            const isCurrent = idx === currentIdx
            const isFuture  = idx > currentIdx

            return (
              <div key={step.status} className="flex items-start gap-3">
                {/* Dot + connector */}
                <div className="flex flex-col items-center">
                  <div className={[
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all duration-300',
                    isPast    ? 'bg-[#FF5722] text-white'
                    : isCurrent ? 'bg-[#FF5722] text-white ring-4 ring-[#FF5722]/25'
                    : 'bg-gray-700 text-gray-500',
                  ].join(' ')}>
                    {isPast ? '✓' : idx + 1}
                  </div>
                  {idx < STEPS.length - 1 && (
                    <div className={[
                      'mt-1 h-6 w-0.5 transition-colors duration-500',
                      isPast ? 'bg-[#FF5722]' : 'bg-gray-700',
                    ].join(' ')} />
                  )}
                </div>

                {/* Label */}
                <div className="pb-4 pt-0.5">
                  <p className={[
                    'text-sm font-semibold transition-colors duration-300',
                    isCurrent ? 'text-[#FF5722]'
                    : isPast   ? 'text-gray-400'
                    : isFuture ? 'text-gray-600'
                    : '',
                  ].join(' ')}>
                    {step.label}
                  </p>
                  {isCurrent && (
                    <p className="text-xs text-gray-500">{step.sub}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Items summary */}
        <div className="mb-4 w-full rounded-2xl bg-white/5 px-4 py-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-500">Items</p>
          {items.map((item) => (
            <div key={item.dish.id} className="flex justify-between py-1.5 text-sm">
              <span className="text-gray-300">
                {item.dish.name}
                <span className="ml-1 text-gray-500">× {item.quantity}</span>
              </span>
              <span className="font-medium text-white">₹ {item.dish.price * item.quantity}</span>
            </div>
          ))}
          <div className="mt-2 flex justify-between border-t border-white/10 pt-2">
            <span className="text-sm font-bold text-gray-300">Total</span>
            <span className="font-bold text-white">₹ {order.total}</span>
          </div>
        </div>

        {/* Download GST bill */}
        <button
          type="button"
          onClick={handleDownloadBill}
          disabled={billBusy}
          className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 py-4 text-base font-bold text-white active:bg-white/20 disabled:opacity-60"
        >
          {billBusy ? 'Generating bill…' : '📄 Download Bill'}
        </button>
        {billError && (
          <p className="mb-3 -mt-1 w-full text-center text-xs text-red-400">{billError}</p>
        )}

        {/* Action button */}
        {isDelivered ? (
          <button
            type="button"
            onClick={onDismiss}
            className="w-full rounded-xl bg-[#FF5722] py-4 text-base font-bold text-white active:bg-orange-700"
          >
            Done
          </button>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-white py-4 text-base font-bold text-gray-900 active:bg-gray-100"
          >
            Back to Menu
          </button>
        )}
      </div>
    </div>
  )
}
