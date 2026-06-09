import { useMemo, useState, type ReactNode } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useRestaurant } from '../hooks/useRestaurant'
import {
  detectDevice,
  formatDuration,
  formatINR,
  RANGE_LABELS,
  useAnalyticsEvents,
  useDishMap,
  useLiveOrders,
  useRangeOrders,
  useTableMap,
  type AnalyticsEventLite,
  type OrderWithItems,
  type TimeRange,
} from '../hooks/useAnalytics'

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCENT = '#FF5722'
const DONUT_COLORS = ['#FF5722', '#22c55e', '#3b82f6', '#a855f7', '#f59e0b', '#64748b']
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Six discrete heat levels expressed as full Tailwind classes so the JIT
// scanner picks them up. Index 0 = no orders, 5 = busiest bucket.
const HEAT_CLASSES = [
  'bg-slate-100',
  'bg-[#FF5722]/20',
  'bg-[#FF5722]/40',
  'bg-[#FF5722]/60',
  'bg-[#FF5722]/80',
  'bg-[#FF5722]',
]

const EVENT_LABELS: Record<string, string> = {
  menu_view: 'Menu Views',
  ar_view: 'AR Views',
  dish_view: 'Item Clicks',
  waiter_call: 'Waiter Calls',
}

type Tab = 'revenue' | 'kitchen' | 'menu' | 'customers'
const TABS: { key: Tab; label: string }[] = [
  { key: 'revenue', label: 'Revenue' },
  { key: 'kitchen', label: 'Kitchen' },
  { key: 'menu', label: 'Menu' },
  { key: 'customers', label: 'Customers' },
]

// ─── Shared UI ────────────────────────────────────────────────────────────────

function MetricCard({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-black text-gray-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-bold text-gray-900">{title}</h3>
      {children}
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-72 flex-col items-center justify-center gap-2 text-center">
      <span className="text-3xl">📊</span>
      <p className="text-sm font-medium text-gray-400">{message}</p>
    </div>
  )
}

// Safely read a metadata key off an event.
function meta(e: AnalyticsEventLite, key: string): unknown {
  const m = e.metadata
  return m && typeof m === 'object' ? (m as Record<string, unknown>)[key] : undefined
}

const num = (n: number | null | undefined) => Number(n) || 0

// ─── Revenue tab ──────────────────────────────────────────────────────────────

function hourLabel(h: number): string {
  const ap = h < 12 ? 'a' : 'p'
  let hr = h % 12
  if (hr === 0) hr = 12
  return `${hr}${ap}`
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}
function dayLabel(d: Date): string {
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

function RevenueTab({ restaurantId, range }: { restaurantId?: string; range: TimeRange }) {
  const { data: orders = [] } = useRangeOrders(restaurantId, range)
  const { data: tableMap } = useTableMap(restaurantId)

  const m = useMemo(() => {
    const gross = orders.reduce((s, o) => s + num(o.total), 0)
    const count = orders.length
    const itemsSold = orders.reduce(
      (s, o) => s + (o.order_items ?? []).reduce((q, i) => q + num(i.quantity), 0),
      0,
    )
    return { gross, count, aov: count ? gross / count : 0, itemsSold }
  }, [orders])

  const series = useMemo(() => {
    const byBucket = new Map<string, number>()
    if (range === 'today') {
      for (let h = 0; h < 24; h++) byBucket.set(String(h), 0)
      for (const o of orders) {
        if (!o.created_at) continue
        const h = new Date(o.created_at).getHours()
        byBucket.set(String(h), (byBucket.get(String(h)) ?? 0) + num(o.total))
      }
      return Array.from({ length: 24 }, (_, h) => ({
        label: hourLabel(h),
        revenue: byBucket.get(String(h)) ?? 0,
      }))
    }
    // Daily buckets
    const labels = new Map<string, string>()
    for (const o of orders) {
      if (!o.created_at) continue
      const d = new Date(o.created_at)
      const k = dayKey(d)
      byBucket.set(k, (byBucket.get(k) ?? 0) + num(o.total))
      labels.set(k, dayLabel(d))
    }
    return Array.from(byBucket.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, revenue]) => ({ label: labels.get(k) ?? k, revenue }))
  }, [orders, range])

  const topTables = useMemo(() => {
    const byTable = new Map<string, number>()
    for (const o of orders) {
      if (!o.table_id) continue
      byTable.set(o.table_id, (byTable.get(o.table_id) ?? 0) + num(o.total))
    }
    return Array.from(byTable.entries())
      .map(([id, revenue]) => ({ name: `Table ${tableMap?.get(id) ?? '—'}`, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6)
  }, [orders, tableMap])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Gross Revenue" value={formatINR(m.gross)} />
        <MetricCard label="Total Orders" value={m.count} />
        <MetricCard label="Avg Order Value" value={formatINR(m.aov)} />
        <MetricCard label="Items Sold" value={m.itemsSold} />
      </div>

      <ChartCard title="Revenue Over Time">
        {m.count === 0 ? (
          <EmptyState message="No orders in this period yet." />
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip formatter={(v) => formatINR(Number(v))} />
                <Line type="monotone" dataKey="revenue" stroke={ACCENT} strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartCard>

      <ChartCard title="Top Revenue Tables">
        {topTables.length === 0 ? (
          <EmptyState message="No table revenue yet." />
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topTables} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip formatter={(v) => formatINR(Number(v))} cursor={{ fill: '#fff7ed' }} />
                <Bar dataKey="revenue" fill={ACCENT} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartCard>
    </div>
  )
}

// ─── Kitchen tab ──────────────────────────────────────────────────────────────

function avgSeconds(orders: OrderWithItems[], from: keyof OrderWithItems, to: keyof OrderWithItems): number | null {
  let sum = 0
  let n = 0
  for (const o of orders) {
    const a = o[from] as string | null
    const b = o[to] as string | null
    if (!a || !b) continue
    const diff = (new Date(b).getTime() - new Date(a).getTime()) / 1000
    if (diff > 0) {
      sum += diff
      n++
    }
  }
  return n ? sum / n : null
}

function KitchenTab({ restaurantId, range }: { restaurantId?: string; range: TimeRange }) {
  const { data: orders = [] } = useRangeOrders(restaurantId, range)
  const { data: live = [] } = useLiveOrders(restaurantId)
  const { data: events = [] } = useAnalyticsEvents(restaurantId, range)

  const cookSecs = useMemo(() => avgSeconds(orders, 'preparing_at', 'ready_at'), [orders])
  const waitSecs = useMemo(() => {
    // From order placed → ready (falls back gracefully when timestamps absent).
    let sum = 0
    let n = 0
    for (const o of orders) {
      const end = o.ready_at ?? o.delivered_at
      if (!o.created_at || !end) continue
      const diff = (new Date(end).getTime() - new Date(o.created_at).getTime()) / 1000
      if (diff > 0) {
        sum += diff
        n++
      }
    }
    return n ? sum / n : null
  }, [orders])

  const staffCalls = useMemo(() => events.filter((e) => e.event_type === 'waiter_call').length, [events])
  const pendingNow = useMemo(() => live.filter((o) => o.status === 'pending').length, [live])

  const heatmap = useMemo(() => {
    const grid: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0))
    let max = 0
    for (const o of orders) {
      if (!o.created_at) continue
      const d = new Date(o.created_at)
      const day = d.getDay()
      const hour = d.getHours()
      grid[day][hour]++
      if (grid[day][hour] > max) max = grid[day][hour]
    }
    return { grid, max }
  }, [orders])

  const statusDonut = useMemo(() => {
    const counts = { pending: 0, preparing: 0, ready: 0 } as Record<string, number>
    for (const o of live) if (o.status && o.status in counts) counts[o.status]++
    return [
      { name: 'Pending', value: counts.pending },
      { name: 'Cooking', value: counts.preparing },
      { name: 'Ready', value: counts.ready },
    ].filter((d) => d.value > 0)
  }, [live])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Avg Cook Time" value={formatDuration(cookSecs)} sub="preparing → ready" />
        <MetricCard label="Avg Wait Time" value={formatDuration(waitSecs)} sub="ordered → ready" />
        <MetricCard label="Staff Calls" value={staffCalls} sub={RANGE_LABELS[range]} />
        <MetricCard label="Pending Orders" value={pendingNow} sub="right now" />
      </div>

      <ChartCard title="Activity Heatmap — orders by day & hour">
        <div className="overflow-x-auto">
          <div className="min-w-[640px]">
            {/* Hour header */}
            <div className="mb-1 flex pl-10">
              {Array.from({ length: 24 }, (_, h) => (
                <div key={h} className="flex-1 text-center text-[9px] text-gray-400">
                  {h % 3 === 0 ? hourLabel(h) : ''}
                </div>
              ))}
            </div>
            {heatmap.grid.map((row, day) => (
              <div key={day} className="mb-0.5 flex items-center">
                <div className="w-10 text-xs font-medium text-gray-500">{DAYS[day]}</div>
                {row.map((count, hour) => {
                  const bucket = count === 0 ? 0 : Math.min(5, Math.ceil((count / (heatmap.max || 1)) * 5))
                  return (
                    <div key={hour} className="flex-1 px-px">
                      <div
                        className={`h-5 rounded-sm ${HEAT_CLASSES[bucket]}`}
                        title={`${DAYS[day]} ${hourLabel(hour)} — ${count} order${count === 1 ? '' : 's'}`}
                      />
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </ChartCard>

      <ChartCard title="Live Order Status">
        {statusDonut.length === 0 ? (
          <EmptyState message="No active orders right now." />
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusDonut} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={2}>
                  {statusDonut.map((_, i) => (
                    <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartCard>
    </div>
  )
}

// ─── Menu tab ─────────────────────────────────────────────────────────────────

function MenuTab({ restaurantId, range }: { restaurantId?: string; range: TimeRange }) {
  const { data: orders = [] } = useRangeOrders(restaurantId, range)
  const { data: events = [] } = useAnalyticsEvents(restaurantId, range)
  const { data: dishMap } = useDishMap(restaurantId)

  const dishName = (id: string | null) => (id && dishMap?.get(id)?.name) || 'Unknown dish'

  // Aggregate line items across all in-range orders.
  const agg = useMemo(() => {
    const vol = new Map<string, number>()
    const rev = new Map<string, number>()
    for (const o of orders) {
      for (const it of o.order_items ?? []) {
        if (!it.dish_id) continue
        vol.set(it.dish_id, (vol.get(it.dish_id) ?? 0) + num(it.quantity))
        rev.set(it.dish_id, (rev.get(it.dish_id) ?? 0) + num(it.quantity) * num(it.price))
      }
    }
    const topVolume = Array.from(vol.entries())
      .map(([id, qty]) => ({ name: dishName(id), value: qty }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
    const topRevenue = Array.from(rev.entries())
      .map(([id, r]) => ({ name: dishName(id), value: r }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
    return { topVolume, topRevenue }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, dishMap])

  // Best seller TODAY (always today, regardless of selected range).
  const bestSeller = useMemo(() => {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const vol = new Map<string, number>()
    for (const o of orders) {
      if (!o.created_at || new Date(o.created_at) < start) continue
      for (const it of o.order_items ?? []) {
        if (!it.dish_id) continue
        vol.set(it.dish_id, (vol.get(it.dish_id) ?? 0) + num(it.quantity))
      }
    }
    let top: { id: string; qty: number } | null = null
    for (const [id, qty] of vol) if (!top || qty > top.qty) top = { id, qty }
    return top
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, dishMap])

  // Most viewed dish (dish_view events).
  const mostViewed = useMemo(() => {
    const views = new Map<string, number>()
    for (const e of events) {
      if (e.event_type !== 'dish_view' || !e.dish_id) continue
      views.set(e.dish_id, (views.get(e.dish_id) ?? 0) + 1)
    }
    let top: { id: string; n: number } | null = null
    for (const [id, n] of views) if (!top || n > top.n) top = { id, n }
    return top
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, dishMap])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">🏆 Best Seller (Today)</p>
          {bestSeller ? (
            <>
              <p className="mt-1 text-xl font-black text-gray-900">{dishName(bestSeller.id)}</p>
              <p className="mt-0.5 text-xs text-gray-400">{bestSeller.qty} sold today</p>
            </>
          ) : (
            <p className="mt-1 text-sm text-gray-400">No sales yet today.</p>
          )}
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">👁️ Most Viewed</p>
          {mostViewed ? (
            <>
              <p className="mt-1 text-xl font-black text-gray-900">{dishName(mostViewed.id)}</p>
              <p className="mt-0.5 text-xs text-gray-400">{mostViewed.n} views</p>
            </>
          ) : (
            <p className="mt-1 text-sm text-gray-400">No dish views tracked yet.</p>
          )}
        </div>
      </div>

      <ChartCard title="Top 5 Items by Volume">
        {agg.topVolume.length === 0 ? (
          <EmptyState message="No items sold in this period." />
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={agg.topVolume} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: '#475569' }} />
                <Tooltip cursor={{ fill: '#fff7ed' }} />
                <Bar dataKey="value" fill={ACCENT} radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartCard>

      <ChartCard title="Top 5 Items by Revenue">
        {agg.topRevenue.length === 0 ? (
          <EmptyState message="No revenue in this period." />
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={agg.topRevenue} layout="vertical" margin={{ top: 5, right: 20, left: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: '#475569' }} />
                <Tooltip formatter={(v) => formatINR(Number(v))} cursor={{ fill: '#fff7ed' }} />
                <Bar dataKey="value" fill="#22c55e" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartCard>
    </div>
  )
}

// ─── Customers tab ────────────────────────────────────────────────────────────

function CustomersTab({ restaurantId, range }: { restaurantId?: string; range: TimeRange }) {
  const { data: events = [] } = useAnalyticsEvents(restaurantId, range)

  const m = useMemo(() => {
    let arViews = 0
    let menuViews = 0
    const devices = new Set<string>()
    const sessionsByDevice = new Map<string, Set<string>>()
    const deviceTypes: Record<string, number> = { iOS: 0, Android: 0, Desktop: 0 }
    const typeCounts = new Map<string, number>()

    for (const e of events) {
      if (e.event_type === 'ar_view') arViews++
      if (e.event_type === 'menu_view') menuViews++

      typeCounts.set(e.event_type, (typeCounts.get(e.event_type) ?? 0) + 1)

      const deviceId = meta(e, 'device_id')
      if (typeof deviceId === 'string') {
        devices.add(deviceId)
        const sessionId = meta(e, 'session_id')
        if (typeof sessionId === 'string') {
          if (!sessionsByDevice.has(deviceId)) sessionsByDevice.set(deviceId, new Set())
          sessionsByDevice.get(deviceId)!.add(sessionId)
        }
      }

      const ua = meta(e, 'user_agent')
      if (ua !== undefined) deviceTypes[detectDevice(ua)]++
    }

    const uniqueVisitors = devices.size
    let returning = 0
    for (const sessions of sessionsByDevice.values()) if (sessions.size > 1) returning++
    const returnRate = uniqueVisitors ? (returning / uniqueVisitors) * 100 : 0

    const deviceDonut = Object.entries(deviceTypes)
      .map(([name, value]) => ({ name, value }))
      .filter((d) => d.value > 0)

    const typeDonut = Array.from(typeCounts.entries())
      .map(([type, value]) => ({ name: EVENT_LABELS[type] ?? type, value }))
      .sort((a, b) => b.value - a.value)

    return {
      arViews,
      menuViews,
      totalViews: arViews + menuViews,
      interactions: events.length,
      uniqueVisitors,
      returnRate,
      hasDeviceData: deviceDonut.length > 0,
      deviceDonut,
      typeDonut,
    }
  }, [events])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          label="Total Views"
          value={m.totalViews}
          sub={`${m.arViews} AR · ${m.menuViews} menu`}
        />
        <MetricCard label="Total Interactions" value={m.interactions} sub={RANGE_LABELS[range]} />
        <MetricCard label="Unique Visitors" value={m.uniqueVisitors} sub="unique devices" />
        <MetricCard
          label="Return Rate"
          value={m.uniqueVisitors ? `${m.returnRate.toFixed(0)}%` : '—'}
          sub="repeat visitors"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Device Breakdown">
          {!m.hasDeviceData ? (
            <EmptyState message="No device data yet — guest app needs to record user-agent." />
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={m.deviceDonut} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={2}>
                    {m.deviceDonut.map((_, i) => (
                      <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard title="Interaction Types">
          {m.typeDonut.length === 0 ? (
            <EmptyState message="No interactions tracked yet." />
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={m.typeDonut} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={2}>
                    {m.typeDonut.map((_, i) => (
                      <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { restaurant } = useRestaurant()
  const restaurantId = restaurant?.id
  const [tab, setTab] = useState<Tab>('revenue')
  const [range, setRange] = useState<TimeRange>('today')

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-black text-gray-900">Analytics</h1>

        {/* Range toggle */}
        <div className="flex flex-wrap gap-1 rounded-xl bg-gray-100 p-1">
          {(['today', 'week', 'month', 'all'] as TimeRange[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={[
                'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                range === r ? 'bg-white text-[#FF5722] shadow-sm' : 'text-gray-500 hover:text-gray-700',
              ].join(' ')}
            >
              {RANGE_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-5 flex gap-1 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={[
              '-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors',
              tab === t.key
                ? 'border-[#FF5722] text-[#FF5722]'
                : 'border-transparent text-gray-500 hover:text-gray-800',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'revenue' && <RevenueTab restaurantId={restaurantId} range={range} />}
      {tab === 'kitchen' && <KitchenTab restaurantId={restaurantId} range={range} />}
      {tab === 'menu' && <MenuTab restaurantId={restaurantId} range={range} />}
      {tab === 'customers' && <CustomersTab restaurantId={restaurantId} range={range} />}
    </div>
  )
}
