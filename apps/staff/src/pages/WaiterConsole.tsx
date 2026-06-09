import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useBeep } from '../lib/useBeep'
import { useStaffAuth } from '../context/StaffAuthContext'
import { useTables } from '../hooks/useTables'
import MenuBrowser from '../components/MenuBrowser'
import OrderPanel from '../components/OrderPanel'
import TablesTab from '../components/TablesTab'
import ProfileTab from '../components/ProfileTab'
import WaiterHistoryTab from '../components/WaiterHistoryTab'
import type { Dish, OrderLine, Restaurant } from '../types'

interface Props {
  restaurant: Restaurant
}

// Waiter ready beep — lower pitch than the chef's new-order beep.
const WAITER_TONES = [{ t: 0, f: 880 }, { t: 0.18, f: 1175 }]
// Waiter call beep — urgent double-tap to differentiate from order-ready.
const WAITER_CALL_TONES = [{ t: 0, f: 1047 }, { t: 0.15, f: 1047 }, { t: 0.35, f: 1319 }]

type Tab = 'dishes' | 'order' | 'tables' | 'profile' | 'history'
const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'dishes',  label: 'Dishes',   icon: '🍽️' },
  { key: 'order',   label: 'Order',    icon: '🧾' },
  { key: 'tables',  label: 'Tables',   icon: '🪑' },
  { key: 'history', label: 'History',  icon: '📋' },
  { key: 'profile', label: 'Profile',  icon: '👤' },
]

// ─── Ready notification ──────────────────────────────────────────────────────

interface ReadyNotification {
  key: number
  tokenNumber: number | null
  tableNumber: string | null
}

function ReadyPopup({ notification, onDismiss }: { notification: ReadyNotification; onDismiss: () => void }) {
  useEffect(() => {
    const id = setTimeout(onDismiss, 10_000)
    return () => clearTimeout(id)
  }, [notification.key, onDismiss])

  const tableLabel = notification.tableNumber ? `Table ${notification.tableNumber}` : 'Takeaway'

  return (
    <div
      role="alertdialog"
      aria-label="Order ready notification"
      className="fixed left-1/2 top-4 z-50 w-[min(380px,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-green-300"
    >
      <div className="h-1 bg-green-100">
        <div className="animate-countdown h-full bg-green-500" />
      </div>
      <div className="px-5 py-4">
        <p className="text-xl font-black text-gray-900">
          🍽️ Token #{notification.tokenNumber ?? '—'} is Ready — {tableLabel}
        </p>
        <div className="mt-3 animate-pulse rounded-xl bg-green-500 py-2 text-center text-sm font-bold uppercase tracking-wide text-white">
          Ready to Serve
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="mt-4 w-full rounded-xl bg-green-600 py-3 text-sm font-bold text-white transition-colors hover:bg-green-700 active:scale-[0.98]"
        >
          Got it
        </button>
      </div>
    </div>
  )
}

// ─── Waiter call notification ─────────────────────────────────────────────────

interface WaiterCallNotification {
  key: number
  tableNumber: string | null
}

function WaiterCallPopup({ notification, onDismiss }: { notification: WaiterCallNotification; onDismiss: () => void }) {
  useEffect(() => {
    const id = setTimeout(onDismiss, 15_000)
    return () => clearTimeout(id)
  }, [notification.key, onDismiss])

  const tableLabel = notification.tableNumber ? `Table ${notification.tableNumber}` : 'a guest'

  return (
    <div
      role="alertdialog"
      aria-label="Waiter call notification"
      className="fixed left-1/2 top-4 z-[60] w-[min(380px,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-orange-300"
    >
      <div className="h-1 bg-orange-100">
        <div className="animate-countdown h-full bg-[#FF5722]" />
      </div>
      <div className="px-5 py-4">
        <p className="text-xl font-black text-gray-900">
          🔔 {tableLabel} is calling for a waiter
        </p>
        <button
          type="button"
          onClick={onDismiss}
          className="mt-4 w-full rounded-xl bg-[#FF5722] py-3 text-sm font-bold text-white transition-colors hover:opacity-90 active:scale-[0.98]"
        >
          On my way
        </button>
      </div>
    </div>
  )
}

// ─── WaiterConsole ────────────────────────────────────────────────────────────

export default function WaiterConsole({ restaurant }: Props) {
  const { member, logout } = useStaffAuth()
  const { data: tables } = useTables(restaurant.id)
  const [lines, setLines] = useState<OrderLine[]>([])
  const [notification, setNotification] = useState<ReadyNotification | null>(null)
  const [waiterCallNotif, setWaiterCallNotif] = useState<WaiterCallNotification | null>(null)
  const [tab, setTab] = useState<Tab>('dishes')

  const playReadyBeep     = useBeep(WAITER_TONES)
  const playWaiterCallBeep = useBeep(WAITER_CALL_TONES)

  // Persist the selected table so a refresh keeps the waiter on the same table.
  const tableStorageKey = `waiter_selected_table_${restaurant.id}`
  const [selectedTableId, setSelectedTableId] = useState<string | null>(
    () => sessionStorage.getItem(tableStorageKey) || null,
  )

  useEffect(() => {
    if (selectedTableId) sessionStorage.setItem(tableStorageKey, selectedTableId)
    else sessionStorage.removeItem(tableStorageKey)
  }, [selectedTableId, tableStorageKey])

  // Keep table list fresh for the Realtime callback without re-subscribing.
  const tablesRef = useRef(tables)
  useEffect(() => { tablesRef.current = tables }, [tables])

  // Watch for orders turning 'ready' for this restaurant.
  useEffect(() => {
    const channel = supabase
      .channel(`waiter-ready-${restaurant.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurant.id}` },
        (payload) => {
          const row = payload.new as { status: string | null; token_number: number | null; table_id: string | null }
          if (row.status !== 'ready') return
          const tbl = row.table_id ? (tablesRef.current ?? []).find((t) => t.id === row.table_id) : null
          setNotification({ key: Date.now(), tokenNumber: row.token_number, tableNumber: tbl?.number ?? null })
          playReadyBeep()
        },
      )
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [restaurant.id, playReadyBeep])

  // Watch for waiter-call events from guests at this restaurant.
  useEffect(() => {
    const channel = supabase
      .channel(`waiter-calls-${restaurant.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'analytics_events', filter: `restaurant_id=eq.${restaurant.id}` },
        (payload) => {
          const row = payload.new as { event_type: string; table_id: string | null }
          console.log('[WaiterConsole] analytics_events INSERT received:', row)
          if (row.event_type !== 'waiter_call') return
          const tbl = row.table_id ? (tablesRef.current ?? []).find((t) => t.id === row.table_id) : null
          setWaiterCallNotif({ key: Date.now(), tableNumber: tbl?.number ?? null })
          playWaiterCallBeep()
        },
      )
      .subscribe((status) => {
        console.log('[WaiterConsole] waiter-calls channel status:', status)
      })

    return () => { void supabase.removeChannel(channel) }
  }, [restaurant.id, playWaiterCallBeep])

  // ── Cart handlers ───────────────────────────────────────────────────────────

  function addDish(dish: Dish) {
    setLines((prev) => {
      const existing = prev.find((l) => l.dish.id === dish.id)
      if (existing) {
        return prev.map((l) => (l.dish.id === dish.id ? { ...l, quantity: l.quantity + 1 } : l))
      }
      return [...prev, { dish, quantity: 1 }]
    })
  }

  function changeQty(dishId: string, quantity: number) {
    setLines((prev) =>
      quantity <= 0
        ? prev.filter((l) => l.dish.id !== dishId)
        : prev.map((l) => (l.dish.id === dishId ? { ...l, quantity } : l)),
    )
  }

  function clear() { setLines([]) }
  function handleSent() { setLines([]) }

  function pickTable(id: string) {
    setSelectedTableId(id)
    setTab('order')
  }

  const itemCount = lines.reduce((s, l) => s + l.quantity, 0)
  const cartTotal = lines.reduce((s, l) => s + l.dish.price * l.quantity, 0)

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      {notification && (
        <ReadyPopup notification={notification} onDismiss={() => setNotification(null)} />
      )}
      {waiterCallNotif && (
        <WaiterCallPopup notification={waiterCallNotif} onDismiss={() => setWaiterCallNotif(null)} />
      )}

      {/* Top bar */}
      <header className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-5 py-3">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-black text-gray-900">{restaurant.name}</h1>
          <p className="text-xs text-gray-400">Waiter Console</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-semibold text-gray-900">{member?.name}</p>
            <p className="text-xs capitalize text-gray-400">{member?.role}</p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Log out
          </button>
        </div>
      </header>

      {/* Tab navigation */}
      <nav className="flex shrink-0 border-b border-gray-200 bg-white">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={[
              'relative flex flex-1 items-center justify-center gap-1.5 border-b-2 py-3 text-sm font-semibold transition-colors',
              tab === t.key ? 'border-[#FF5722] text-[#FF5722]' : 'border-transparent text-gray-500 hover:text-gray-800',
            ].join(' ')}
          >
            <span>{t.icon}</span>
            <span className="hidden sm:inline">{t.label}</span>
            {t.key === 'order' && itemCount > 0 && (
              <span className="ml-0.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[#FF5722] px-1.5 text-xs font-bold text-white">
                {itemCount}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Tab content */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {/* Dishes */}
        <div className={['h-full', tab === 'dishes' ? 'block' : 'hidden'].join(' ')}>
          <MenuBrowser restaurantId={restaurant.id} onAdd={addDish} />
          {/* Floating "view order" bar */}
          {itemCount > 0 && (
            <button
              type="button"
              onClick={() => setTab('order')}
              className="absolute bottom-4 left-1/2 flex w-[min(420px,calc(100%-2rem))] -translate-x-1/2 items-center justify-between rounded-2xl bg-[#FF5722] px-5 py-3.5 text-white shadow-xl active:scale-[0.99]"
            >
              <span className="text-sm font-bold">
                {itemCount} item{itemCount === 1 ? '' : 's'} · ₹ {cartTotal}
              </span>
              <span className="text-sm font-black">View Order →</span>
            </button>
          )}
        </div>

        {/* Current order */}
        <div className={['h-full', tab === 'order' ? 'block' : 'hidden'].join(' ')}>
          <OrderPanel
            restaurantId={restaurant.id}
            staffId={member?.id}
            tables={tables ?? []}
            selectedTableId={selectedTableId}
            onSelectTable={setSelectedTableId}
            lines={lines}
            onChangeQty={changeQty}
            onClear={clear}
            onSent={handleSent}
          />
        </div>

        {/* Tables */}
        <div className={['h-full overflow-y-auto', tab === 'tables' ? 'block' : 'hidden'].join(' ')}>
          <TablesTab
            restaurantId={restaurant.id}
            selectedTableId={selectedTableId}
            onPickTable={pickTable}
          />
        </div>

        {/* Profile */}
        <div className={['h-full overflow-y-auto', tab === 'profile' ? 'block' : 'hidden'].join(' ')}>
          {member && (
            <ProfileTab
              member={member}
              restaurantId={restaurant.id}
              restaurantName={restaurant.name}
              onSwitchStaff={logout}
              onLogout={logout}
            />
          )}
        </div>

        {/* History */}
        <div className={['h-full', tab === 'history' ? 'block' : 'hidden'].join(' ')}>
          {member && (
            <WaiterHistoryTab
              restaurantId={restaurant.id}
              staffId={member.id}
            />
          )}
        </div>
      </div>
    </div>
  )
}
