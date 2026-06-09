import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useBeep } from '../lib/useBeep'
import { useStaffAuth } from '../context/StaffAuthContext'
import { useActiveOrders, type KitchenOrder } from '../hooks/useActiveOrders'
import { useStaffMenu } from '../hooks/useStaffMenu'
import { useTables } from '../hooks/useTables'
import type { Dish, Restaurant } from '../types'

interface Props {
  restaurant: Restaurant
}

// Chef new-order beep — higher pitch than the waiter's ready beep so they're
// distinguishable across the two screens.
const CHEF_TONES = [{ t: 0, f: 1318 }, { t: 0.18, f: 1760 }]

// ─── Elapsed timer ────────────────────────────────────────────────────────────

function elapsed(iso: string | null, nowMs: number): { label: string; mins: number } {
  if (!iso) return { label: '0:00', mins: 0 }
  const diffMs = Math.max(0, nowMs - new Date(iso).getTime())
  const totalSec = Math.floor(diffMs / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return { label: `${m}:${s.toString().padStart(2, '0')}`, mins: m }
}

// ─── Order card ───────────────────────────────────────────────────────────────

function OrderCard({
  order,
  nowMs,
  onUpdate,
  marked,
  onMarkOutOfStock,
}: {
  order: KitchenOrder
  nowMs: number
  onUpdate: (id: string, status: string) => void
  marked: Set<string>
  onMarkOutOfStock: (dishId: string) => void
}) {
  const { label, mins } = elapsed(order.created_at, nowMs)
  const isPending = order.status === 'pending'

  const urgency =
    mins >= 10 ? 'border-red-500' : mins >= 5 ? 'border-amber-500' : 'border-gray-700'

  return (
    <div className={`flex flex-col rounded-2xl border-2 ${urgency} bg-gray-800 shadow-xl`}>
      <div className="flex items-start justify-between border-b border-gray-700 px-5 py-3">
        <div>
          <p className="text-3xl font-black leading-none text-white">
            {order.tableNumber ? `Table ${order.tableNumber}` : 'Takeaway'}
          </p>
          <p className="mt-1 text-sm font-semibold text-[#FF5722]">Token #{order.token_number}</p>
        </div>
        <div className="text-right">
          <p
            className={[
              'text-2xl font-black tabular-nums leading-none',
              mins >= 10 ? 'text-red-400' : mins >= 5 ? 'text-amber-400' : 'text-gray-300',
            ].join(' ')}
          >
            {label}
          </p>
          <span
            className={[
              'mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-bold uppercase',
              isPending ? 'bg-orange-500/20 text-orange-300' : 'bg-amber-500/20 text-amber-300',
            ].join(' ')}
          >
            {isPending ? 'New' : 'Cooking'}
          </span>
        </div>
      </div>

      <div className="flex-1 px-5 py-3">
        <ul className="space-y-2">
          {order.items.map((item, i) => {
            const isMarked = !!item.dish_id && marked.has(item.dish_id)
            return (
              <li key={i} className="flex items-start justify-between gap-3 text-white">
                <div className="flex min-w-0 items-baseline gap-3">
                  <span className="min-w-[2.5rem] text-2xl font-black text-[#FF5722]">
                    {item.quantity}×
                  </span>
                  <div className="min-w-0">
                    <span className="text-xl font-semibold leading-tight">{item.name}</span>
                    {item.notes && (
                      <p className="text-sm italic text-[#FF5722]">{item.notes}</p>
                    )}
                  </div>
                </div>
                {item.dish_id &&
                  (isMarked ? (
                    <span className="shrink-0 text-xs font-semibold text-gray-500">
                      Out of stock ✓
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onMarkOutOfStock(item.dish_id as string)}
                      className="shrink-0 text-xs font-semibold text-red-500 hover:text-red-400"
                    >
                      Mark Out of Stock
                    </button>
                  ))}
              </li>
            )
          })}
        </ul>
      </div>

      <div className="flex gap-2 border-t border-gray-700 p-3">
        {isPending && (
          <button
            type="button"
            onClick={() => onUpdate(order.id, 'preparing')}
            className="flex-1 rounded-xl bg-amber-500 py-3 text-base font-bold text-gray-900 transition-colors hover:bg-amber-400 active:scale-[0.98]"
          >
            Cook All
          </button>
        )}
        <button
          type="button"
          onClick={() => onUpdate(order.id, 'ready')}
          className="flex-1 rounded-xl bg-green-600 py-3 text-base font-bold text-white transition-colors hover:bg-green-500 active:scale-[0.98]"
        >
          Done
        </button>
      </div>
    </div>
  )
}

// ─── Feature 3: New-order notification popup ─────────────────────────────────

interface NewOrderNote {
  key: number
  tokenNumber: number | null
  tableNumber: string | null
}

function NewOrderPopup({
  note,
  total,
  onDismiss,
}: {
  note: NewOrderNote
  total: number
  onDismiss: () => void
}) {
  // 8s auto-dismiss. onDismiss is stable (useCallback) and this component is
  // remounted per order via a `key`, so the timer restarts cleanly for each
  // queued order and is NOT reset by the parent's 1s clock tick.
  useEffect(() => {
    const id = setTimeout(onDismiss, 8_000)
    return () => clearTimeout(id)
  }, [onDismiss])

  const tableLabel = note.tableNumber ? `Table ${note.tableNumber}` : 'Takeaway'

  return (
    <div
      role="alert"
      className="fixed left-1/2 top-4 z-[60] w-[min(380px,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-2xl bg-gray-800 shadow-2xl ring-1 ring-[#FF5722]/60"
    >
      <div className="h-1 bg-gray-700">
        <div className="animate-countdown-fast h-full bg-[#FF5722]" />
      </div>
      <div className="px-5 py-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-2xl font-black text-white">🔔 New Order</p>
          {total > 1 && (
            <span className="shrink-0 rounded-full bg-[#FF5722]/20 px-2.5 py-1 text-xs font-bold text-[#FF5722]">
              1 of {total}
            </span>
          )}
        </div>
        <p className="mt-1 text-base font-semibold text-[#FF5722]">
          {tableLabel}, Token #{note.tokenNumber ?? '—'}
        </p>
        <button
          type="button"
          onClick={onDismiss}
          className="mt-4 w-full rounded-xl bg-[#FF5722] py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 active:scale-[0.98]"
        >
          OK
        </button>
      </div>
    </div>
  )
}

// ─── Feature 1: Stock management overlay ─────────────────────────────────────

type StockState = 'in_stock' | 'low_stock' | 'out_of_stock'

function dishStockState(dish: Dish): StockState {
  if (dish.is_available === false) return 'out_of_stock'
  if (dish.stock_note) return 'low_stock'
  return 'in_stock'
}

function VegDot({ isVeg }: { isVeg: boolean }) {
  const color = isVeg ? '#00a550' : '#e40000'
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="mt-0.5 shrink-0">
      <rect x="0.5" y="0.5" width="15" height="15" rx="1.5" stroke={color} strokeWidth="1.5" fill="white" />
      <circle cx="8" cy="8" r="4.5" fill={color} />
    </svg>
  )
}

function DishInventoryCard({
  dish,
  onUpdate,
}: {
  dish: Dish
  onUpdate: (id: string, patch: { is_available?: boolean; stock_note?: string | null }) => void
}) {
  const [state, setState] = useState<StockState>(() => dishStockState(dish))
  const [noteInput, setNoteInput] = useState(dish.stock_note ?? '')
  const noteTimer = useRef<ReturnType<typeof setTimeout>>()

  // Re-sync when parent data refetches via Realtime.
  useEffect(() => {
    setState(dishStockState(dish))
    setNoteInput(dish.stock_note ?? '')
  }, [dish.is_available, dish.stock_note])

  useEffect(() => () => clearTimeout(noteTimer.current), [])

  function handleStateChange(next: StockState) {
    setState(next)
    if (next === 'in_stock') {
      setNoteInput('')
      onUpdate(dish.id, { is_available: true, stock_note: null })
    } else if (next === 'out_of_stock') {
      setNoteInput('')
      onUpdate(dish.id, { is_available: false, stock_note: null })
    } else {
      // low_stock — stays available; note saved as the chef types (debounced)
      onUpdate(dish.id, { is_available: true })
    }
  }

  function handleNoteChange(val: string) {
    setNoteInput(val)
    clearTimeout(noteTimer.current)
    noteTimer.current = setTimeout(() => {
      onUpdate(dish.id, { stock_note: val || null })
    }, 600)
  }

  const STATES: { key: StockState; label: string; on: string; off: string }[] = [
    { key: 'in_stock',     label: 'In Stock',     on: 'bg-green-600 text-white', off: 'text-green-400 hover:bg-green-900/40' },
    { key: 'low_stock',    label: 'Low Stock',    on: 'bg-amber-500 text-gray-900', off: 'text-amber-400 hover:bg-amber-900/40' },
    { key: 'out_of_stock', label: 'Out of Stock', on: 'bg-red-600 text-white', off: 'text-red-400 hover:bg-red-900/40' },
  ]

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-800 p-3">
      <div className="mb-2 flex items-start gap-2">
        <VegDot isVeg={dish.is_veg !== false} />
        <span className="flex-1 text-sm font-bold text-white">{dish.name}</span>
      </div>
      <div className="flex gap-1.5">
        {STATES.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => handleStateChange(s.key)}
            className={[
              'flex-1 rounded-lg px-2 py-1.5 text-xs font-bold transition-colors',
              state === s.key ? s.on : `bg-gray-700/50 ${s.off}`,
            ].join(' ')}
          >
            {s.label}
          </button>
        ))}
      </div>
      {state === 'low_stock' && (
        <input
          type="text"
          value={noteInput}
          onChange={(e) => handleNoteChange(e.target.value)}
          placeholder='e.g. "3 left", "5 portions left"'
          className="mt-2 w-full rounded-lg border border-amber-700 bg-amber-900/20 px-3 py-1.5 text-xs text-amber-200 placeholder-amber-700/80 outline-none focus:border-amber-500"
        />
      )}
    </div>
  )
}

function StockOverlay({ restaurantId, onClose }: { restaurantId: string; onClose: () => void }) {
  const { data: categories = [] } = useStaffMenu(restaurantId)

  async function handleUpdate(
    dishId: string,
    patch: { is_available?: boolean; stock_note?: string | null },
  ) {
    const { error } = await supabase.from('dishes').update(patch).eq('id', dishId)
    if (error) console.error('[StockOverlay] update failed:', error.message)
    // Realtime on dishes pushes the change to guest + waiter instantly.
  }

  const total = categories.reduce((n, c) => n + c.dishes.length, 0)

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-900">
      <header className="flex shrink-0 items-center justify-between border-b border-gray-800 px-6 py-4">
        <div>
          <h2 className="text-xl font-black text-white">Manage Stock</h2>
          <p className="text-xs text-gray-500">Changes apply instantly to the guest menu &amp; waiter console</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-gray-700 px-4 py-2 text-sm font-semibold text-gray-300 hover:bg-gray-800 hover:text-white"
        >
          Done
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        {total === 0 ? (
          <p className="py-16 text-center text-gray-500">No dishes loaded.</p>
        ) : (
          categories.map((cat) =>
            cat.dishes.length === 0 ? null : (
              <section key={cat.id} className="mb-8">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gray-400">
                  {cat.icon && <span>{cat.icon}</span>}
                  {cat.name}
                </h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {cat.dishes.map((dish) => (
                    <DishInventoryCard key={dish.id} dish={dish} onUpdate={handleUpdate} />
                  ))}
                </div>
              </section>
            ),
          )
        )}
      </div>
    </div>
  )
}

// ─── Main KitchenDisplay ──────────────────────────────────────────────────────

export default function KitchenDisplay({ restaurant }: Props) {
  const { member, logout } = useStaffAuth()
  const { data: orders, isLoading } = useActiveOrders(restaurant.id)
  const { data: tables } = useTables(restaurant.id)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [marked, setMarked] = useState<Set<string>>(() => new Set())
  const [stockOpen, setStockOpen] = useState(false)
  // Queue of unacknowledged new-order popups — chef sees the oldest first.
  const [orderQueue, setOrderQueue] = useState<NewOrderNote[]>([])
  const noteKeyRef = useRef(0)

  const playChefBeep = useBeep(CHEF_TONES)

  // Stable so NewOrderPopup's auto-dismiss timer survives the 1s clock tick.
  const dismissCurrentOrder = useCallback(() => {
    setOrderQueue((prev) => prev.slice(1))
  }, [])

  // Keep table list fresh for the Realtime callback without re-subscribing.
  const tablesRef = useRef(tables)
  useEffect(() => { tablesRef.current = tables }, [tables])

  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  // Feature 3 — new order arrives via Realtime INSERT.
  useEffect(() => {
    const channel = supabase
      .channel(`kitchen-new-order-${restaurant.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
          filter: `restaurant_id=eq.${restaurant.id}`,
        },
        (payload) => {
          const row = payload.new as {
            token_number: number | null
            table_id: string | null
          }
          const tbl = row.table_id
            ? (tablesRef.current ?? []).find((t) => t.id === row.table_id)
            : null
          noteKeyRef.current += 1
          const note: NewOrderNote = {
            key: noteKeyRef.current,
            tokenNumber: row.token_number,
            tableNumber: tbl?.number ?? null,
          }
          setOrderQueue((prev) => [...prev, note])
          playChefBeep()
        },
      )
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [restaurant.id, playChefBeep])

  async function updateStatus(id: string, status: string) {
    const patch: {
      status: string
      preparing_at?: string
      ready_at?: string
      delivered_at?: string
    } = { status }
    const nowIso = new Date().toISOString()
    if (status === 'preparing') patch.preparing_at = nowIso
    else if (status === 'ready') patch.ready_at = nowIso
    else if (status === 'delivered') patch.delivered_at = nowIso

    const { error } = await supabase.from('orders').update(patch).eq('id', id)
    if (error) console.error('[KitchenDisplay] status update failed:', error.message)
  }

  async function markOutOfStock(dishId: string) {
    setMarked((prev) => new Set(prev).add(dishId))
    const { error } = await supabase
      .from('dishes')
      .update({ is_available: false })
      .eq('id', dishId)
    if (error) {
      console.error('[KitchenDisplay] out-of-stock update failed:', error.message)
      setMarked((prev) => { const next = new Set(prev); next.delete(dishId); return next })
    }
  }

  const list = orders ?? []

  return (
    <div className="flex h-screen flex-col bg-gray-900">
      {/* Feature 3: new-order popup — one at a time from the queue, oldest first */}
      {orderQueue.length > 0 && (
        <NewOrderPopup
          key={orderQueue[0].key}
          note={orderQueue[0]}
          total={orderQueue.length}
          onDismiss={dismissCurrentOrder}
        />
      )}

      {/* Top bar */}
      <header className="flex shrink-0 items-center justify-between border-b border-gray-800 px-6 py-3">
        <div>
          <h1 className="text-xl font-black text-white">{restaurant.name}</h1>
          <p className="text-xs uppercase tracking-widest text-[#FF5722]">Kitchen Display</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-gray-800 px-3 py-1.5 text-sm font-bold text-white">
            {list.length} active
          </span>
          <button
            type="button"
            onClick={() => setStockOpen(true)}
            className="rounded-lg border border-gray-600 px-3 py-1.5 text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white"
          >
            Manage Stock
          </button>
          <div className="text-right">
            <p className="text-sm font-semibold text-white">{member?.name}</p>
            <p className="text-xs capitalize text-gray-500">{member?.role}</p>
          </div>
          <button
            type="button"
            onClick={() => { setOrderQueue([]); logout() }}
            className="rounded-lg border border-gray-700 px-3 py-1.5 text-sm font-medium text-gray-300 hover:bg-gray-800"
          >
            Log out
          </button>
        </div>
      </header>

      {/* Board */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading && (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-56 animate-pulse rounded-2xl bg-gray-800" />
            ))}
          </div>
        )}

        {!isLoading && list.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <span className="text-6xl">🍳</span>
            <p className="text-xl font-bold text-gray-400">All caught up!</p>
            <p className="text-sm text-gray-600">New orders will appear here automatically.</p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {list.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              nowMs={nowMs}
              onUpdate={updateStatus}
              marked={marked}
              onMarkOutOfStock={markOutOfStock}
            />
          ))}
        </div>
      </div>

      {/* Feature 1: stock overlay */}
      {stockOpen && (
        <StockOverlay restaurantId={restaurant.id} onClose={() => setStockOpen(false)} />
      )}
    </div>
  )
}
