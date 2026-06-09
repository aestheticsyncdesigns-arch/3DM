import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useOrderStatus } from '../hooks/useOrderStatus'
import { useTableOrders } from '../hooks/useTableOrders'
import { useUnpaidOrders } from '../hooks/useUnpaidOrders'
import type { OrderLine, RestaurantTable } from '../types'

// Reads the logged-in staff member's id directly from sessionStorage.
// More reliable than prop drilling — works even if a prop is undefined.
function getSessionStaffId(): string | null {
  try {
    const raw = sessionStorage.getItem('3dm_staff')
    if (!raw) return null
    return (JSON.parse(raw) as { id?: string }).id ?? null
  } catch {
    return null
  }
}

interface SentOrder {
  id: string
  token_number: number
  tableId: string
}

const sentOrderKey = (tableId: string) => `waiter_sent_order_${tableId}`

// Status → badge label + colours for the Table Orders history list.
const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Pending', cls: 'bg-orange-100 text-orange-700' },
  preparing: { label: 'Cooking', cls: 'bg-amber-100 text-amber-700' },
  ready: { label: 'Ready', cls: 'bg-green-100 text-green-700' },
}

/**
 * Collapsible history of all not-yet-delivered orders for the selected table.
 * Updates live via Realtime (useTableOrders).
 */
function TableOrdersSection({ tableId }: { tableId: string }) {
  const { data: orders } = useTableOrders(tableId)
  const [open, setOpen] = useState(true)
  const list = orders ?? []

  if (list.length === 0) return null

  return (
    <div className="border-t border-gray-200">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-bold text-gray-900">
          Table Orders
          <span className="ml-1.5 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">
            {list.length}
          </span>
        </span>
        <svg
          className={`h-4 w-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <div className="max-h-56 space-y-2 overflow-y-auto px-4 pb-3">
          {list.map((o) => {
            const badge = STATUS_BADGE[o.status ?? ''] ?? {
              label: o.status ?? '—',
              cls: 'bg-gray-100 text-gray-600',
            }
            return (
              <div key={o.id} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-900">
                    Token #{o.token_number}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-bold ${badge.cls}`}
                  >
                    {badge.label}
                  </span>
                </div>
                <ul className="space-y-0.5">
                  {o.items.map((it, i) => (
                    <li key={i} className="text-xs text-gray-600">
                      <span className="font-semibold text-gray-800">{it.quantity}×</span>{' '}
                      {it.name}
                      {it.notes && (
                        <span className="italic text-[#FF5722]"> — {it.notes}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Collect Payment ────────────────────────────────────────────────────────

type PayMethod = 'cash' | 'card' | 'upi'

const PAY_METHODS: { key: PayMethod; label: string; icon: string }[] = [
  { key: 'cash', label: 'Cash', icon: '💵' },
  { key: 'card', label: 'Card', icon: '💳' },
  { key: 'upi', label: 'UPI', icon: '📱' },
]

const METHOD_LABEL: Record<PayMethod, string> = { cash: 'Cash', card: 'Card', upi: 'UPI' }

/**
 * Payment collection for the selected table. Lists every delivered-but-unpaid
 * order with its bill, lets the waiter pick a method, confirms the amount, and
 * records payment_status = 'paid' on the orders row. Realtime drops the order
 * off the list once paid; a brief "Payment Received" note confirms the action.
 */
function CollectPaymentSection({ tableId, staffId }: { tableId: string; staffId?: string | null }) {
  const { data: orders } = useUnpaidOrders(tableId)
  const [pending, setPending] = useState<{ orderId: string; total: number; method: PayMethod } | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [justPaid, setJustPaid] = useState<{ total: number; method: PayMethod } | null>(null)
  const justPaidTimer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => () => clearTimeout(justPaidTimer.current), [])

  const list = orders ?? []
  if (list.length === 0 && !justPaid) return null

  async function confirmPay() {
    if (!pending) return
    setSavingId(pending.orderId)
    setError(null)
    // Use sessionStorage as primary source so paid_by is always the real staff UUID.
    const paidBy = getSessionStaffId() ?? staffId ?? null
    const { error: err } = await supabase
      .from('orders')
      .update({
        payment_status: 'paid',
        payment_method: pending.method,
        paid_by: paidBy,
        paid_at: new Date().toISOString(),
      })
      .eq('id', pending.orderId)
    setSavingId(null)
    if (err) {
      setError(err.message)
      return
    }
    setJustPaid({ total: pending.total, method: pending.method })
    setPending(null)
    clearTimeout(justPaidTimer.current)
    justPaidTimer.current = setTimeout(() => setJustPaid(null), 4000)
  }

  return (
    <div className="border-t-4 border-green-100 bg-green-50/40">
      <div className="px-4 py-3">
        <h3 className="flex items-center gap-1.5 text-sm font-bold text-gray-900">
          💰 Collect Payment
          {list.length > 0 && (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
              {list.length}
            </span>
          )}
        </h3>
      </div>

      {justPaid && (
        <div className="mx-4 mb-3 rounded-xl border border-green-300 bg-green-100 px-4 py-3 text-center">
          <p className="text-sm font-black text-green-700">Payment Received ✓</p>
          <p className="mt-0.5 text-xs text-green-600">
            ₹ {justPaid.total} via {METHOD_LABEL[justPaid.method]}
          </p>
        </div>
      )}

      <div className="space-y-3 px-4 pb-4">
        {list.map((o) => {
          const gst = (o.cgst_amount ?? 0) + (o.sgst_amount ?? 0)
          return (
            <div key={o.id} className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-bold text-gray-900">Token #{o.token_number}</span>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-500">
                  Unpaid
                </span>
              </div>

              {/* Itemised bill */}
              <ul className="space-y-1 border-t border-gray-100 pt-2">
                {o.items.map((it, i) => (
                  <li key={i} className="flex items-baseline justify-between gap-2 text-xs">
                    <span className="min-w-0 flex-1 truncate text-gray-600">
                      <span className="font-semibold text-gray-800">{it.quantity}×</span> {it.name}
                    </span>
                    <span className="shrink-0 text-gray-500">₹ {it.price * it.quantity}</span>
                  </li>
                ))}
              </ul>

              {/* Totals */}
              <div className="mt-2 space-y-0.5 border-t border-gray-100 pt-2 text-xs">
                <div className="flex justify-between text-gray-500">
                  <span>Subtotal</span>
                  <span>₹ {o.subtotal ?? 0}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>GST</span>
                  <span>₹ {gst}</span>
                </div>
                <div className="flex justify-between pt-0.5 text-sm font-bold text-gray-900">
                  <span>Total</span>
                  <span>₹ {o.total ?? 0}</span>
                </div>
              </div>

              {/* Method buttons */}
              <div className="mt-3 grid grid-cols-3 gap-2">
                {PAY_METHODS.map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    disabled={savingId === o.id}
                    onClick={() =>
                      setPending({ orderId: o.id, total: o.total ?? 0, method: m.key })
                    }
                    className="flex flex-col items-center gap-0.5 rounded-lg border border-gray-200 bg-gray-50 py-2 text-xs font-bold text-gray-700 transition-colors hover:border-green-400 hover:bg-green-50 disabled:opacity-50"
                  >
                    <span className="text-base">{m.icon}</span>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Confirmation dialog */}
      {pending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
          <div className="w-full max-w-xs rounded-2xl bg-white p-5 shadow-2xl">
            <p className="text-center text-base font-bold text-gray-900">
              Confirm ₹ {pending.total} received via {METHOD_LABEL[pending.method]}?
            </p>
            {error && (
              <p className="mt-2 text-center text-xs font-medium text-red-500">{error}</p>
            )}
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                disabled={savingId === pending.orderId}
                onClick={() => { setPending(null); setError(null) }}
                className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={savingId === pending.orderId}
                onClick={() => void confirmPay()}
                className="flex-1 rounded-xl bg-green-600 py-3 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-60"
              >
                {savingId === pending.orderId ? 'Saving…' : 'Yes, Paid'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Live status row for an order the waiter just sent. Subscribes via Realtime
 * and clears itself once the order is delivered. When the order is ready, shows
 * a prominent "Mark as Served ✓" button with a confirmation dialog.
 */
function OrderStatusBanner({
  order,
  tableNumber,
  onCleared,
}: {
  order: SentOrder
  tableNumber: string | null
  onCleared: () => void
}) {
  const status = useOrderStatus(order.id, 'pending')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [serving, setServing] = useState(false)
  const [served, setServed] = useState(false)

  useEffect(() => {
    if (status === 'delivered') onCleared()
  }, [status, onCleared])

  if (status === 'delivered') return null

  const isReady = status === 'ready'
  const tableLabel = tableNumber ? `Table ${tableNumber}` : 'this table'

  async function markServed() {
    setServing(true)
    const { error } = await supabase
      .from('orders')
      .update({ status: 'delivered', delivered_at: new Date().toISOString() })
      .eq('id', order.id)
    setServing(false)
    if (!error) {
      setServed(true)
      setConfirmOpen(false)
    }
  }

  // Transitional state: shown after the write succeeds but before Realtime fires
  // and calls onCleared(). Gives the waiter instant confirmation.
  if (served) {
    return (
      <div className="flex items-center gap-3 border-t border-green-200 bg-green-50 px-4 py-3">
        <span className="relative inline-flex h-3 w-3 rounded-full bg-green-500" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-green-700">
            Token #{order.token_number} — Served
          </p>
          <p className="text-xs text-gray-400">Collect payment below</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div
        className={[
          'border-t px-4 py-3',
          isReady ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50',
        ].join(' ')}
      >
        {/* Status row */}
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3">
            {isReady && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            )}
            <span
              className={[
                'relative inline-flex h-3 w-3 rounded-full',
                isReady ? 'bg-green-500' : 'bg-amber-500',
              ].join(' ')}
            />
          </span>
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-bold ${isReady ? 'text-green-700' : 'text-gray-800'}`}>
              Token #{order.token_number} — {isReady ? 'Ready to serve' : 'Cooking'}
            </p>
            <p className="text-xs text-gray-400">
              {isReady ? 'Order is ready — serve the table.' : 'Kitchen is preparing this order.'}
            </p>
          </div>
        </div>

        {/* Mark as Served button — only shown when ready */}
        {isReady && (
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className="mt-3 w-full rounded-xl bg-green-600 py-3 text-sm font-bold text-white transition-colors hover:bg-green-700 active:scale-[0.99]"
          >
            Mark as Served ✓
          </button>
        )}
      </div>

      {/* Confirmation dialog */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
          <div className="w-full max-w-xs rounded-2xl bg-white p-5 shadow-2xl">
            <p className="text-center text-base font-bold text-gray-900">
              Confirm {tableLabel} has been served?
            </p>
            <p className="mt-1 text-center text-sm text-gray-500">
              Token #{order.token_number}
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                disabled={serving}
                onClick={() => setConfirmOpen(false)}
                className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={serving}
                onClick={() => void markServed()}
                className="flex-1 rounded-xl bg-green-600 py-3 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-60"
              >
                {serving ? 'Saving…' : 'Yes, Served'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

interface Props {
  restaurantId: string
  staffId?: string | null
  tables: RestaurantTable[]
  selectedTableId: string | null
  onSelectTable: (id: string | null) => void
  lines: OrderLine[]
  onChangeQty: (dishId: string, quantity: number) => void
  onClear: () => void
  onSent: () => void
}

const COUNTDOWN_SECONDS = 10

// Discrete fill widths for the countdown progress bar (one per remaining second),
// so the width is driven by a Tailwind class instead of an inline style. Listed as
// full literals so Tailwind's JIT scanner picks them up. Index = seconds remaining.
const COUNTDOWN_FILL_WIDTHS = [
  'w-0', 'w-[10%]', 'w-[20%]', 'w-[30%]', 'w-[40%]', 'w-[50%]',
  'w-[60%]', 'w-[70%]', 'w-[80%]', 'w-[90%]', 'w-full',
]

type Phase = 'idle' | 'counting' | 'sending'

export default function OrderPanel({
  restaurantId,
  staffId,
  tables,
  selectedTableId,
  onSelectTable,
  lines,
  onChangeQty,
  onClear,
  onSent,
}: Props) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SECONDS)
  const [toast, setToast] = useState<string | null>(null)
  const [sentOrder, setSentOrder] = useState<SentOrder | null>(null)
  // Per-dish special-request notes, keyed by dish id.
  const [notes, setNotes] = useState<Record<string, string>>({})
  const tickRef = useRef<ReturnType<typeof setInterval>>()
  const toastRef = useRef<ReturnType<typeof setTimeout>>()
  // Guards against a double-fire of the RPC (e.g. React StrictMode invoking the
  // countdown's state updater twice, or any other re-entrant call).
  const isFiringRef = useRef(false)

  const subtotal = lines.reduce((s, l) => s + l.dish.price * l.quantity, 0)
  const gst = Math.round(subtotal * 0.05)
  const total = subtotal + gst
  const itemCount = lines.reduce((s, l) => s + l.quantity, 0)

  useEffect(() => {
    return () => {
      clearInterval(tickRef.current)
      clearTimeout(toastRef.current)
    }
  }, [])

  function showToast(msg: string) {
    setToast(msg)
    clearTimeout(toastRef.current)
    toastRef.current = setTimeout(() => setToast(null), 3000)
  }

  // Stable so OrderStatusBanner's delivered-effect doesn't re-fire each render.
  // Clears both the in-memory indicator and its sessionStorage entry.
  const clearSentOrder = useCallback(() => {
    setSentOrder((curr) => {
      if (curr) sessionStorage.removeItem(sentOrderKey(curr.tableId))
      return null
    })
  }, [])

  // Restore the indicator for whichever table is currently selected. Runs on
  // mount and whenever the waiter switches tables, so a refresh (or table switch)
  // brings back the live status of that table's last order.
  useEffect(() => {
    if (!selectedTableId) {
      setSentOrder(null)
      return
    }
    const raw = sessionStorage.getItem(sentOrderKey(selectedTableId))
    setSentOrder(raw ? (JSON.parse(raw) as SentOrder) : null)
  }, [selectedTableId])

  async function fireOrder() {
    // Re-entrancy guard: only the first call proceeds; ignore any duplicate.
    if (isFiringRef.current) return
    isFiringRef.current = true
    clearInterval(tickRef.current)
    setPhase('sending')
    try {
      const cgstAmount = Math.floor(gst / 2)
      const sgstAmount = gst - cgstAmount
      // @ts-expect-error — place_order RPC exists at runtime; types not generated
      const { data, error } = await supabase.rpc('place_order', {
        p_restaurant_id: restaurantId,
        p_table_id: selectedTableId,
        p_guest_phone: null,
        p_subtotal: subtotal,
        p_cgst_amount: cgstAmount,
        p_sgst_amount: sgstAmount,
        p_total: total,
        p_items: lines.map((l) => ({
          dish_id: l.dish.id,
          quantity: l.quantity,
          price: l.dish.price,
          notes: (notes[l.dish.id] ?? '').trim() || null,
        })),
      })

      if (error) throw new Error(error.message)

      const placed = data as { id: string; token_number: number } | null
      if (placed?.id && selectedTableId) {
        // Use sessionStorage as primary source so taken_by is always the real staff UUID.
        const takenBy = getSessionStaffId() ?? staffId ?? null
        if (takenBy) {
          await supabase.from('orders').update({ taken_by: takenBy }).eq('id', placed.id)
        }
        const so: SentOrder = {
          id: placed.id,
          token_number: placed.token_number,
          tableId: selectedTableId,
        }
        sessionStorage.setItem(sentOrderKey(selectedTableId), JSON.stringify(so))
        setSentOrder(so)
      }

      setPhase('idle')
      setNotes({})
      onSent()
      showToast('Order sent to kitchen ✓')
    } catch (err) {
      setPhase('idle')
      const msg = err instanceof Error ? err.message : 'Failed to send order'
      showToast(msg)
    } finally {
      isFiringRef.current = false
    }
  }

  function startCountdown() {
    if (!selectedTableId || lines.length === 0) return
    setPhase('counting')
    setSecondsLeft(COUNTDOWN_SECONDS)
    clearInterval(tickRef.current)
    tickRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(tickRef.current)
          void fireOrder()
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  function undo() {
    clearInterval(tickRef.current)
    setPhase('idle')
    setSecondsLeft(COUNTDOWN_SECONDS)
  }

  const canSend = !!selectedTableId && lines.length > 0

  return (
    <div className="relative flex h-full flex-col bg-white">
      {/* Toast */}
      {toast && (
        <div className="absolute left-1/2 top-4 z-20 -translate-x-1/2 rounded-full bg-gray-900 px-5 py-2.5 shadow-xl">
          <p className="whitespace-nowrap text-sm font-medium text-white">{toast}</p>
        </div>
      )}

      {/* Table selector */}
      <div className="border-b border-gray-200 px-4 py-3">
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
          Table
        </label>
        <select
          aria-label="Select table"
          value={selectedTableId ?? ''}
          onChange={(e) => onSelectTable(e.target.value || null)}
          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-medium text-gray-900 outline-none focus:border-[#FF5722] focus:bg-white"
        >
          <option value="">Select a table…</option>
          {tables.map((t) => (
            <option key={t.id} value={t.id}>
              Table {t.number}
            </option>
          ))}
        </select>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3">
        <h2 className="text-lg font-bold text-gray-900">Current Order</h2>
        {lines.length > 0 && phase === 'idle' && (
          <button
            type="button"
            onClick={onClear}
            className="text-sm font-medium text-gray-400 hover:text-red-500"
          >
            Clear
          </button>
        )}
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {lines.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <span className="text-4xl">🧾</span>
            <p className="font-medium text-gray-400">No items yet.</p>
            <p className="text-sm text-gray-400">Tap dishes on the left to add them.</p>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-gray-50">
            {lines.map((line) => (
              <div key={line.dish.id} className="py-3">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium leading-tight text-gray-900">
                      {line.dish.name}
                    </p>
                    <p className="text-xs text-gray-400">₹ {line.dish.price} each</p>
                  </div>
                  <div className="flex items-center rounded-full border border-[#FF5722]">
                    <button
                      type="button"
                      disabled={phase !== 'idle'}
                      onClick={() => onChangeQty(line.dish.id, line.quantity - 1)}
                      aria-label="Decrease"
                      className="flex h-7 w-7 items-center justify-center text-base font-bold text-[#FF5722] disabled:opacity-40"
                    >
                      −
                    </button>
                    <span className="min-w-[1.5rem] text-center text-sm font-bold text-gray-900">
                      {line.quantity}
                    </span>
                    <button
                      type="button"
                      disabled={phase !== 'idle'}
                      onClick={() => onChangeQty(line.dish.id, line.quantity + 1)}
                      aria-label="Increase"
                      className="flex h-7 w-7 items-center justify-center text-base font-bold text-[#FF5722] disabled:opacity-40"
                    >
                      +
                    </button>
                  </div>
                  <p className="w-16 text-right text-sm font-semibold text-gray-900">
                    ₹ {line.dish.price * line.quantity}
                  </p>
                </div>
                {/* Per-dish special request note */}
                <input
                  type="text"
                  value={notes[line.dish.id] ?? ''}
                  disabled={phase !== 'idle'}
                  onChange={(e) =>
                    setNotes((prev) => ({ ...prev, [line.dish.id]: e.target.value }))
                  }
                  placeholder="Special request e.g. extra butter, no onion..."
                  className="mt-2 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-700 placeholder-gray-400 outline-none focus:border-[#FF5722] focus:bg-white disabled:opacity-50"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Totals + actions */}
      {lines.length > 0 && (
        <div className="border-t border-gray-200 px-4 py-3">
          <div className="mb-3 space-y-1">
            <div className="flex justify-between text-sm text-gray-500">
              <span>Subtotal ({itemCount} item{itemCount !== 1 ? 's' : ''})</span>
              <span>₹ {subtotal}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-500">
              <span>GST (5%)</span>
              <span>₹ {gst}</span>
            </div>
            <div className="flex justify-between border-t border-gray-100 pt-1 text-base font-bold text-gray-900">
              <span>Total</span>
              <span>₹ {total}</span>
            </div>
          </div>

          {phase === 'counting' ? (
            <button
              type="button"
              onClick={undo}
              className="relative w-full overflow-hidden rounded-xl bg-gray-800 py-4 text-base font-bold text-white active:bg-gray-900"
            >
              {/* progress fill — width driven by a Tailwind class, not inline style */}
              <span
                className={`absolute inset-y-0 left-0 bg-[#FF5722]/30 transition-all duration-1000 ease-linear ${
                  COUNTDOWN_FILL_WIDTHS[Math.max(0, Math.min(COUNTDOWN_SECONDS, secondsLeft))]
                }`}
              />
              <span className="relative">
                Undo — sending in {secondsLeft}s
              </span>
            </button>
          ) : (
            <button
              type="button"
              disabled={!canSend || phase === 'sending'}
              onClick={startCountdown}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF5722] py-4 text-base font-bold text-white transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-40"
            >
              {phase === 'sending' ? (
                <>
                  <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="4" />
                    <path fill="white" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Sending…
                </>
              ) : (
                'Send to Kitchen'
              )}
            </button>
          )}

          {!selectedTableId && (
            <p className="mt-2 text-center text-xs text-gray-400">
              Select a table to send the order.
            </p>
          )}
        </div>
      )}

      {/* Live status of the last order sent — clears itself when delivered */}
      {sentOrder && (
        <OrderStatusBanner
          order={sentOrder}
          tableNumber={tables.find((t) => t.id === sentOrder.tableId)?.number ?? null}
          onCleared={clearSentOrder}
        />
      )}

      {/* Collect payment for delivered, unpaid orders on this table */}
      {selectedTableId && <CollectPaymentSection tableId={selectedTableId} staffId={staffId} />}

      {/* All not-yet-delivered orders for this table */}
      {selectedTableId && <TableOrdersSection tableId={selectedTableId} />}
    </div>
  )
}
