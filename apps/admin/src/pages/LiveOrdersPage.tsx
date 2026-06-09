import { useCallback, useEffect, useRef, useState } from 'react'
import type { Database } from '@3dm/shared'
import { supabase } from '../supabase'
import { useRestaurant } from '../hooks/useRestaurant'
import { openBill } from '../lib/bill'

// ─── Types ────────────────────────────────────────────────────────────────────

type OrderRow     = Database['public']['Tables']['orders']['Row']
type OrderItemRow = Database['public']['Tables']['order_items']['Row']
type AnalyticsRow = Database['public']['Tables']['analytics_events']['Row']

// Active schema (migration 002) has no status CHECK constraint. The guest app's
// live order tracker (useOrderStatus) uses 'delivered' as the terminal status, so
// the admin writes 'delivered' when an order is served to keep the guest in sync.
type OrderStatus = 'pending' | 'preparing' | 'ready' | 'delivered'

interface WaiterCall {
  id:         string
  tableLabel: string
  at:         number
}

// ─── Column config ────────────────────────────────────────────────────────────

const COLUMNS: {
  key:         OrderStatus
  title:       string
  dot:         string
  next:        OrderStatus | null
  actionLabel: string
  actionClass: string
}[] = [
  {
    key: 'pending', title: 'Pending', dot: 'bg-orange-500',
    next: 'preparing', actionLabel: 'Confirm & Start Cooking',
    actionClass: 'bg-[#FF5722] hover:opacity-90',
  },
  {
    key: 'preparing', title: 'Cooking', dot: 'bg-amber-500',
    next: 'ready', actionLabel: 'Mark Ready',
    actionClass: 'bg-green-600 hover:bg-green-700',
  },
  {
    key: 'ready', title: 'Ready', dot: 'bg-green-500',
    next: 'delivered', actionLabel: 'Mark Served',
    actionClass: 'bg-gray-700 hover:bg-gray-800',
  },
  {
    key: 'delivered', title: 'Served', dot: 'bg-gray-400',
    next: null, actionLabel: '', actionClass: '',
  },
]

const SERVED_LIMIT = 10

// ─── Time helpers ─────────────────────────────────────────────────────────────

function timeAgo(iso: string | null, nowMs: number): string {
  if (!iso) return ''
  const diff = Math.max(0, nowMs - new Date(iso).getTime())
  const mins = Math.floor(diff / 60000)
  if (mins < 1)  return 'just now'
  if (mins === 1) return '1 min ago'
  if (mins < 60) return `${mins} mins ago`
  const hrs = Math.floor(mins / 60)
  const rem = mins % 60
  if (hrs === 1 && rem === 0) return '1 hr ago'
  if (rem === 0) return `${hrs} hrs ago`
  return `${hrs}h ${rem}m ago`
}

function fmtDuration(mins: number): string {
  if (mins < 1) return '<1m'
  if (mins < 60) return `${Math.round(mins)}m`
  const h = Math.floor(mins / 60)
  const m = Math.round(mins % 60)
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

function startOfTodayISO(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function BellIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin`} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="rgba(0,0,0,0.1)" strokeWidth="4" />
      <path fill="#FF5722" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex-1 rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
      <p className={`mt-1 text-2xl font-black ${accent ?? 'text-gray-900'}`}>{value}</p>
    </div>
  )
}

// ─── Order card ───────────────────────────────────────────────────────────────

// Payment methods offered to the manager as a backup for the waiter's collection.
const PAY_METHODS: { value: string; label: string }[] = [
  { value: 'cash', label: '💵 Cash' },
  { value: 'card', label: '💳 Card' },
  { value: 'upi',  label: '📱 UPI' },
]

interface OrderCardProps {
  order:      OrderRow
  items:      OrderItemRow[]
  dishNames:  Record<string, string>
  staffNames: Record<string, string>
  tableLabel: string
  nowMs:      number
  column:     typeof COLUMNS[number]
  updating:   boolean
  paying:     boolean
  onAdvance:  (order: OrderRow, next: OrderStatus) => void
  onMarkPaid: (order: OrderRow, method: string) => void
}

function OrderCard({ order, items, dishNames, staffNames, tableLabel, nowMs, column, updating, paying, onAdvance, onMarkPaid }: OrderCardProps) {
  const ageMins = order.created_at ? (nowMs - new Date(order.created_at).getTime()) / 60000 : 0

  const [billBusy, setBillBusy] = useState(false)
  async function handleViewBill() {
    setBillBusy(true)
    try { await openBill(order.id) } catch (e) { alert(e instanceof Error ? e.message : 'Could not open the bill') }
    finally { setBillBusy(false) }
  }

  // Urgency ring for pending orders that have been waiting a while
  const urgency =
    column.key === 'pending' && ageMins >= 5 ? 'ring-2 ring-red-400'
    : column.key === 'pending' && ageMins >= 2 ? 'ring-1 ring-amber-300'
    : ''

  return (
    <div className={`rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm ${urgency}`}>
      {/* Header: table + time */}
      <div className="mb-2 flex items-start justify-between">
        <div>
          <p className="text-lg font-black leading-none text-gray-900">{tableLabel}</p>
          {order.token_number != null && (
            <p className="mt-1 text-xs font-medium text-gray-400">Token #{order.token_number}</p>
          )}
          <p className="mt-0.5 text-xs text-gray-400">
            Taken by: {order.taken_by ? (staffNames[order.taken_by] ?? 'Staff') : 'Guest'}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="flex items-center gap-1 whitespace-nowrap text-xs text-gray-400">
            <ClockIcon />
            {timeAgo(order.created_at, nowMs)}
          </span>
          {order.payment_status === 'paid' ? (
            <div className="flex flex-col items-end gap-0.5">
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-bold text-green-700">
                💰 Paid
              </span>
              {order.paid_by && (
                <span className="text-[10px] text-gray-400">
                  by {staffNames[order.paid_by] ?? 'Staff'}
                </span>
              )}
            </div>
          ) : (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-bold text-gray-500">
              Unpaid
            </span>
          )}
        </div>
      </div>

      {/* Items */}
      <ul className="mb-2.5 space-y-1 border-t border-gray-100 pt-2.5">
        {items.length === 0 && <li className="text-xs text-gray-300">No items</li>}
        {items.map(item => (
          <li key={item.id} className="flex items-baseline justify-between gap-2 text-sm">
            <span className="min-w-0 flex-1 truncate text-gray-700">
              <span className="font-semibold text-gray-900">{item.quantity}×</span>{' '}
              {item.dish_id ? dishNames[item.dish_id] ?? 'Item' : 'Item'}
            </span>
            <span className="shrink-0 text-xs text-gray-400">₹{item.price}</span>
          </li>
        ))}
      </ul>

      {/* Total */}
      <div className="flex items-center justify-between border-t border-gray-100 pt-2.5">
        <span className="text-xs text-gray-400">Total</span>
        <span className="text-sm font-bold text-gray-900">₹{order.total ?? 0}</span>
      </div>

      {/* View bill — only on paid orders */}
      {order.payment_status === 'paid' && (
        <button
          type="button"
          onClick={handleViewBill}
          disabled={billBusy}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
        >
          {billBusy ? <Spinner className="h-4 w-4" /> : null}
          {billBusy ? 'Opening…' : '🧾 View Bill'}
        </button>
      )}

      {/* Action */}
      {column.next && (
        <button
          type="button"
          disabled={updating}
          onClick={() => onAdvance(order, column.next!)}
          className={`mt-3 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold text-white shadow-sm transition-all disabled:opacity-60 ${column.actionClass}`}
        >
          {updating ? <Spinner className="h-4 w-4" /> : null}
          {column.actionLabel}
        </button>
      )}

      {/* Manager override: mark a served, unpaid order as paid */}
      {column.key === 'delivered' && order.payment_status !== 'paid' && (
        <select
          aria-label="Mark as paid"
          value=""
          disabled={paying}
          onChange={e => { if (e.target.value) onMarkPaid(order, e.target.value) }}
          className="mt-3 w-full rounded-lg border border-gray-200 bg-white py-2 text-sm font-bold text-gray-700 outline-none focus:border-green-500 disabled:opacity-60"
        >
          <option value="">{paying ? 'Saving…' : 'Mark as Paid…'}</option>
          {PAY_METHODS.map(m => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      )}
    </div>
  )
}

// ─── Waiter call popup stack ──────────────────────────────────────────────────

function WaiterCallStack({ calls, onAck }: { calls: WaiterCall[]; onAck: (id: string) => void }) {
  if (calls.length === 0) return null
  return (
    <div className="fixed right-4 top-4 z-50 flex w-72 flex-col gap-2">
      {calls.map(call => (
        <div
          key={call.id}
          className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 shadow-lg"
        >
          <span className="flex h-9 w-9 shrink-0 animate-bounce items-center justify-center rounded-full bg-amber-400 text-white">
            <BellIcon />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-amber-900">{call.tableLabel} is calling</p>
            <p className="text-xs text-amber-600">Waiter requested</p>
          </div>
          <button
            type="button"
            onClick={() => onAck(call.id)}
            className="shrink-0 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-600"
          >
            OK
          </button>
        </div>
      ))}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function LiveOrdersPage() {
  const { restaurant, isLoading: restaurantLoading } = useRestaurant()
  const restaurantId = restaurant?.id ?? null

  const [orders,      setOrders]      = useState<OrderRow[]>([])
  const [itemsByOrder, setItemsByOrder] = useState<Record<string, OrderItemRow[]>>({})
  const [dishNames,   setDishNames]   = useState<Record<string, string>>({})
  const [tableLabels, setTableLabels] = useState<Record<string, string>>({})
  const [staffNames,  setStaffNames]  = useState<Record<string, string>>({})
  const [todayCount,  setTodayCount]  = useState(0)
  const [isLoading,   setIsLoading]   = useState(true)
  const [error,       setError]       = useState<string | null>(null)
  const [updatingId,  setUpdatingId]  = useState<string | null>(null)
  const [payingId,    setPayingId]    = useState<string | null>(null)
  const [realtimeOn,  setRealtimeOn]  = useState(false)
  const [calls,       setCalls]       = useState<WaiterCall[]>([])
  const [nowMs,       setNowMs]       = useState(Date.now())

  const tableLabelsRef = useRef<Record<string, string>>({})
  const audioCtxRef    = useRef<AudioContext | null>(null)
  const reloadTimer    = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Audio beep (Web Audio API — two soft tones) ─────────────────────────────
  const playBeep = useCallback(() => {
    try {
      const Ctor = window.AudioContext
        ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return
      let ctx = audioCtxRef.current
      if (!ctx) { ctx = new Ctor(); audioCtxRef.current = ctx }
      if (ctx.state === 'suspended') void ctx.resume()

      const start = ctx.currentTime
      ;[{ t: 0, f: 880 }, { t: 0.18, f: 1175 }].forEach(({ t, f }) => {
        const osc  = ctx!.createOscillator()
        const gain = ctx!.createGain()
        osc.type = 'sine'
        osc.frequency.value = f
        gain.gain.setValueAtTime(0.0001, start + t)
        gain.gain.linearRampToValueAtTime(0.16, start + t + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.0001, start + t + 0.16)
        osc.connect(gain)
        gain.connect(ctx!.destination)
        osc.start(start + t)
        osc.stop(start + t + 0.18)
      })
    } catch { /* audio not available — ignore */ }
  }, [])

  // Unlock audio context on first user interaction (browser autoplay policy)
  useEffect(() => {
    function unlock() {
      const Ctor = window.AudioContext
        ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!audioCtxRef.current && Ctor) audioCtxRef.current = new Ctor()
      void audioCtxRef.current?.resume()
      window.removeEventListener('pointerdown', unlock)
    }
    window.addEventListener('pointerdown', unlock)
    return () => window.removeEventListener('pointerdown', unlock)
  }, [])

  // ── Tick every 30s so relative times + avg wait stay fresh ──────────────────
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 30000)
    return () => clearInterval(id)
  }, [])

  // ── Load everything ─────────────────────────────────────────────────────────
  const loadAll = useCallback(async (silent = false) => {
    if (!restaurantId) return
    if (!silent) setIsLoading(true)
    setError(null)

    // Tables → label map
    const { data: tables } = await supabase
      .from('tables')
      .select('id, number')
      .eq('restaurant_id', restaurantId)
    const labels: Record<string, string> = {}
    for (const t of tables ?? []) labels[t.id] = `Table ${t.number}`
    setTableLabels(labels)
    tableLabelsRef.current = labels

    // Staff → name map (fetched once; used to resolve taken_by / paid_by UUIDs)
    const { data: staff } = await supabase
      .from('staff')
      .select('id, name')
      .eq('restaurant_id', restaurantId)
    const sNames: Record<string, string> = {}
    for (const s of staff ?? []) sNames[s.id] = s.name
    setStaffNames(sNames)

    // Active orders (pending / preparing / ready) — oldest first
    const { data: active, error: activeErr } = await supabase
      .from('orders')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .in('status', ['pending', 'preparing', 'ready'])
      .order('created_at', { ascending: true })

    if (activeErr) { setError(activeErr.message); setIsLoading(false); return }

    // Recently served (status 'delivered') — newest first, capped
    const { data: served } = await supabase
      .from('orders')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .eq('status', 'delivered')
      .order('created_at', { ascending: false })
      .limit(SERVED_LIMIT)

    const allOrders = [...(active ?? []), ...(served ?? [])]
    setOrders(allOrders)

    // Order items for these orders
    const orderIds = allOrders.map(o => o.id)
    if (orderIds.length > 0) {
      const { data: items } = await supabase
        .from('order_items')
        .select('*')
        .in('order_id', orderIds)

      const grouped: Record<string, OrderItemRow[]> = {}
      const dishIds = new Set<string>()
      for (const it of items ?? []) {
        if (!it.order_id) continue
        ;(grouped[it.order_id] ??= []).push(it)
        if (it.dish_id) dishIds.add(it.dish_id)
      }
      setItemsByOrder(grouped)

      // Dish names
      if (dishIds.size > 0) {
        const { data: dishes } = await supabase
          .from('dishes')
          .select('id, name')
          .in('id', Array.from(dishIds))
        const names: Record<string, string> = {}
        for (const d of dishes ?? []) names[d.id] = d.name
        setDishNames(names)
      }
    } else {
      setItemsByOrder({})
    }

    // Total orders today (count only)
    const { count } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId)
      .gte('created_at', startOfTodayISO())
    setTodayCount(count ?? 0)

    setIsLoading(false)
  }, [restaurantId])

  const scheduleReload = useCallback(() => {
    if (reloadTimer.current) clearTimeout(reloadTimer.current)
    reloadTimer.current = setTimeout(() => { void loadAll(true) }, 250)
  }, [loadAll])

  // ── Initial load ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!restaurantId) return
    void loadAll()
  }, [restaurantId, loadAll])

  // ── Realtime subscriptions ──────────────────────────────────────────────────
  useEffect(() => {
    if (!restaurantId) return

    const channel = supabase
      .channel(`live-orders-${restaurantId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` },
        () => scheduleReload(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'order_items' },
        () => scheduleReload(),
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'analytics_events', filter: `restaurant_id=eq.${restaurantId}` },
        payload => {
          const row = payload.new as Partial<AnalyticsRow>
          if (row.event_type !== 'waiter_call') return
          const tableLabel = (row.table_id && tableLabelsRef.current[row.table_id]) || 'A table'
          setCalls(prev => [
            { id: row.id ?? `${Date.now()}`, tableLabel, at: Date.now() },
            ...prev.filter(c => c.id !== row.id),
          ])
          playBeep()
        },
      )
      .subscribe(status => setRealtimeOn(status === 'SUBSCRIBED'))

    return () => { void supabase.removeChannel(channel) }
  }, [restaurantId, scheduleReload, playBeep])

  // ── Advance an order to the next status ─────────────────────────────────────
  async function handleAdvance(order: OrderRow, next: OrderStatus) {
    setUpdatingId(order.id)
    const prev = order.status
    // Optimistic
    setOrders(cur => cur.map(o => o.id === order.id ? { ...o, status: next } : o))

    // Stamp the transition time so Analytics can measure cook / wait time.
    const patch: Database['public']['Tables']['orders']['Update'] = { status: next }
    const nowIso = new Date().toISOString()
    if (next === 'preparing') patch.preparing_at = nowIso
    else if (next === 'ready') patch.ready_at = nowIso
    else if (next === 'delivered') patch.delivered_at = nowIso

    const { error: err } = await supabase
      .from('orders')
      .update(patch)
      .eq('id', order.id)

    setUpdatingId(null)
    if (err) {
      setError(err.message)
      // Roll back
      setOrders(cur => cur.map(o => o.id === order.id ? { ...o, status: prev } : o))
    }
  }

  // ── Manager override: record payment on a served, unpaid order ──────────────
  async function handleMarkPaid(order: OrderRow, method: string) {
    setPayingId(order.id)
    const prev = { status: order.payment_status, method: order.payment_method }
    // Optimistic
    setOrders(cur => cur.map(o => o.id === order.id ? { ...o, payment_status: 'paid', payment_method: method } : o))

    const { error: err } = await supabase
      .from('orders')
      .update({ payment_status: 'paid', payment_method: method })
      .eq('id', order.id)

    setPayingId(null)
    if (err) {
      setError(err.message)
      // Roll back
      setOrders(cur => cur.map(o => o.id === order.id ? { ...o, payment_status: prev.status, payment_method: prev.method } : o))
    }
  }

  function ackCall(id: string) {
    setCalls(prev => prev.filter(c => c.id !== id))
  }

  // ── Derived ──────────────────────────────────────────────────────────────────
  const pendingCount = orders.filter(o => o.status === 'pending').length
  const activeOrders = orders.filter(o => o.status === 'pending' || o.status === 'preparing' || o.status === 'ready')
  const avgWaitMins  = activeOrders.length > 0
    ? activeOrders.reduce((sum, o) => sum + (o.created_at ? nowMs - new Date(o.created_at).getTime() : 0), 0) / activeOrders.length / 60000
    : 0

  function ordersFor(status: OrderStatus): OrderRow[] {
    const list = orders.filter(o => o.status === status)
    return status === 'delivered'
      ? list.sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()).slice(0, SERVED_LIMIT)
      : list.sort((a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime())
  }

  function labelFor(order: OrderRow): string {
    if (!order.table_id) return 'Takeaway'
    return tableLabels[order.table_id] ?? 'Table'
  }

  if (restaurantLoading || isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  return (
    <div>
      <WaiterCallStack calls={calls} onAck={ackCall} />

      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-gray-900">
            Live Orders
            <span className={[
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
              realtimeOn ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400',
            ].join(' ')}>
              <span className={`h-1.5 w-1.5 rounded-full ${realtimeOn ? 'animate-pulse bg-green-500' : 'bg-gray-400'}`} />
              {realtimeOn ? 'Live' : 'Connecting…'}
            </span>
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">Manage incoming orders in real time</p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="mb-6 flex flex-wrap gap-3">
        <StatCard label="Orders Today" value={String(todayCount)} />
        <StatCard label="Pending" value={String(pendingCount)} accent={pendingCount > 0 ? 'text-[#FF5722]' : undefined} />
        <StatCard label="Avg Wait" value={activeOrders.length ? fmtDuration(avgWaitMins) : '—'} />
      </div>

      {error && <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

      {/* Kanban board */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map(column => {
          const colOrders = ordersFor(column.key)
          return (
            <div key={column.key} className="flex flex-col rounded-2xl bg-gray-50/80 p-3">
              {/* Column header */}
              <div className="mb-3 flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${column.dot}`} />
                  <span className="text-sm font-bold text-gray-800">{column.title}</span>
                </div>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-gray-500 shadow-sm">
                  {colOrders.length}
                </span>
              </div>

              {/* Cards */}
              <div className="flex flex-col gap-3">
                {colOrders.length === 0 && (
                  <p className="rounded-xl border border-dashed border-gray-200 py-8 text-center text-xs text-gray-300">
                    {column.key === 'pending' ? 'No new orders' : `Nothing ${column.title.toLowerCase()}`}
                  </p>
                )}
                {colOrders.map(order => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    items={itemsByOrder[order.id] ?? []}
                    dishNames={dishNames}
                    staffNames={staffNames}
                    tableLabel={labelFor(order)}
                    nowMs={nowMs}
                    column={column}
                    updating={updatingId === order.id}
                    paying={payingId === order.id}
                    onAdvance={handleAdvance}
                    onMarkPaid={handleMarkPaid}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
