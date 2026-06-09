import { useState } from 'react'
import { useWaiterHistory, type DateRange } from '../hooks/useWaiterHistory'
import { useTables } from '../hooks/useTables'

interface Props {
  restaurantId: string
  staffId: string
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  pending:   { label: 'Pending',   cls: 'bg-amber-100 text-amber-700' },
  confirmed: { label: 'Confirmed', cls: 'bg-blue-100 text-blue-700' },
  preparing: { label: 'Cooking',   cls: 'bg-orange-100 text-orange-700' },
  ready:     { label: 'Ready',     cls: 'bg-green-100 text-green-700' },
  delivered: { label: 'Served',    cls: 'bg-gray-100 text-gray-500' },
}

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  cash: 'Cash',
  card: 'Card',
  upi:  'UPI',
}

const RANGE_TABS: { key: DateRange; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week',  label: 'This Week' },
  { key: 'all',   label: 'All' },
]

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function WaiterHistoryTab({ restaurantId, staffId }: Props) {
  const [range, setRange] = useState<DateRange>('today')
  const { data: orders = [], isLoading } = useWaiterHistory(restaurantId, staffId, range)
  const { data: tables = [] } = useTables(restaurantId)

  const tableMap = Object.fromEntries(tables.map(t => [t.id, t.number]))

  const totalRevenue = orders.reduce((s, o) => s + (o.total ?? 0), 0)
  const paidCount    = orders.filter(o => o.paymentStatus === 'paid').length
  const unpaidCount  = orders.length - paidCount

  const emptyLabel =
    range === 'today' ? 'No orders yet today'
    : range === 'week' ? 'No orders this week'
    : 'No orders yet'

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Date-range toggle */}
      <div className="shrink-0 border-b border-gray-200 bg-white px-4 py-3">
        <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
          {RANGE_TABS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setRange(key)}
              className={[
                'flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all',
                range === key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Summary bar — only when there are orders */}
        {orders.length > 0 && (
          <div className="sticky top-0 z-10 border-b border-gray-100 bg-white/95 px-4 py-2.5 backdrop-blur-sm">
            <div className="flex items-center gap-4 text-sm">
              <div>
                <span className="font-black text-gray-900">{orders.length}</span>
                <span className="ml-1 text-gray-400">Orders</span>
              </div>
              <div>
                <span className="font-black text-gray-900">
                  ₹{totalRevenue.toLocaleString('en-IN')}
                </span>
                <span className="ml-1 text-gray-400">Revenue</span>
              </div>
              <div className="ml-auto flex items-center gap-1.5 text-xs">
                <span className="rounded-full bg-green-100 px-2 py-0.5 font-semibold text-green-700">
                  💰 {paidCount}
                </span>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 font-semibold text-gray-500">
                  Unpaid {unpaidCount}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Loading skeleton */}
        {isLoading && (
          <div className="space-y-3 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl bg-gray-100" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && orders.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
            <span className="text-5xl">🧾</span>
            <p className="font-semibold text-gray-600">{emptyLabel}</p>
            <p className="text-sm text-gray-400">Orders you take will appear here</p>
          </div>
        )}

        {/* Order cards */}
        {!isLoading && orders.length > 0 && (
          <div className="space-y-3 p-4">
            {orders.map(order => {
              const statusMeta = STATUS_META[order.status ?? ''] ?? {
                label: order.status ?? '—',
                cls:   'bg-gray-100 text-gray-500',
              }
              const tableNumber = order.tableId ? tableMap[order.tableId] : null
              const itemsLabel  = order.items.length > 0
                ? order.items.map(i => `${i.quantity}× ${i.dishName}`).join(', ')
                : '—'

              return (
                <div key={order.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-base font-black text-gray-900">
                        {tableNumber ? `Table ${tableNumber}` : 'Takeaway'}
                        {order.tokenNumber != null && (
                          <span className="ml-2 text-sm font-bold text-gray-400">
                            #{order.tokenNumber}
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-400">
                        {order.createdAt ? relativeTime(order.createdAt) : '—'}
                      </p>
                    </div>

                    {/* Payment badge */}
                    <div className="flex flex-col items-end gap-0.5">
                      {order.paymentStatus === 'paid' ? (
                        <>
                          <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-bold text-green-700">
                            💰 Paid
                          </span>
                          {order.paymentMethod && (
                            <span className="text-[10px] text-gray-400">
                              {PAYMENT_METHOD_LABEL[order.paymentMethod] ?? order.paymentMethod}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-400">
                          Unpaid
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Items */}
                  <p className="mt-2 text-sm leading-snug text-gray-600">{itemsLabel}</p>

                  {/* Footer row */}
                  <div className="mt-3 flex items-center justify-between">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusMeta.cls}`}>
                      {statusMeta.label}
                    </span>
                    {order.total != null && (
                      <p className="text-base font-black text-gray-900">
                        ₹{order.total.toLocaleString('en-IN')}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
