import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../supabase'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useRestaurant } from '../hooks/useRestaurant'
import {
  formatINR,
  formatDuration,
  useLiveOrders,
  useRangeOrders,
  useTableMap,
} from '../hooks/useAnalytics'
import {
  FIN_RANGE_LABELS,
  startOfToday,
  useDishCatalog,
  usePendingPayments,
  useRangeFinancials,
  useStaffRoster,
  useTodayOrders,
  type FinRange,
  type TodayOrder,
} from '../hooks/useOverview'

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCENT = '#FF5722'
const DONUT_COLORS = ['#FF5722', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#64748b']
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const HEAT_CLASSES = [
  'bg-gray-100', 'bg-[#FF5722]/20', 'bg-[#FF5722]/40',
  'bg-[#FF5722]/60', 'bg-[#FF5722]/80', 'bg-[#FF5722]',
]

const num = (n: number | null | undefined) => Number(n) || 0

function hourLabel(h: number): string {
  const ap = h < 12 ? 'a' : 'p'
  let hr = h % 12
  if (hr === 0) hr = 12
  return `${hr}${ap}`
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

function LiveCard({ icon, label, value, accent }: { icon: string; label: string; value: ReactNode; accent?: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      </div>
      <p className={`mt-2 text-3xl font-black ${accent ?? 'text-gray-900'}`}>{value}</p>
    </div>
  )
}

function Card({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-900">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  )
}

function Empty({ message }: { message: string }) {
  return (
    <div className="flex h-48 flex-col items-center justify-center gap-2 text-center">
      <span className="text-3xl">📊</span>
      <p className="text-sm font-medium text-gray-400">{message}</p>
    </div>
  )
}

// ─── CSV export ───────────────────────────────────────────────────────────────

function csvCell(v: string | number): string {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function downloadTodayCSV(orders: TodayOrder[], tableMap: Map<string, string> | undefined) {
  const header = ['Token', 'Table', 'Status', 'Total', 'Payment Status', 'Payment Method', 'Placed At']
  const rows = orders.map((o) => [
    o.token_number ?? '',
    o.table_id ? tableMap?.get(o.table_id) ?? '—' : 'Takeaway',
    o.status ?? '',
    num(o.total),
    o.payment_status ?? 'unpaid',
    o.payment_method ?? '',
    o.created_at ? new Date(o.created_at).toLocaleString('en-IN') : '',
  ])
  const csv = [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OverviewPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { restaurant } = useRestaurant()
  const restaurantId = restaurant?.id
  const [finRange, setFinRange] = useState<FinRange>('today')
  const [markingId, setMarkingId] = useState<string | null>(null)

  // Record a cash payment on a delivered-but-unpaid order (guest paid at counter).
  async function markCashPaid(orderId: string) {
    setMarkingId(orderId)
    const { error } = await supabase
      .from('orders')
      .update({ payment_status: 'paid', payment_method: 'cash', paid_at: new Date().toISOString() })
      .eq('id', orderId)
    setMarkingId(null)
    if (!error) queryClient.invalidateQueries({ queryKey: ['overview'] })
  }

  const { data: today = [] } = useTodayOrders(restaurantId)
  const { data: live = [] } = useLiveOrders(restaurantId)
  const { data: staff = [] } = useStaffRoster(restaurantId)
  const { data: pending = [] } = usePendingPayments(restaurantId)
  const { data: fin = [] } = useRangeFinancials(restaurantId, finRange)
  const { data: week = [] } = useRangeOrders(restaurantId, 'week')
  const { data: dishCatalog } = useDishCatalog(restaurantId)
  const { data: tableMap } = useTableMap(restaurantId)

  // ── Live cards ──────────────────────────────────────────────────────────────
  const activeOrders = live.length
  const staffOnDuty = useMemo(() => {
    const since = startOfToday().getTime()
    return staff.filter((s) => s.last_active_at && new Date(s.last_active_at).getTime() >= since).length
  }, [staff])
  const avgWaitSecs = useMemo(() => {
    let sum = 0, n = 0
    for (const o of today) {
      if (o.status !== 'delivered' || !o.created_at || !o.delivered_at) continue
      const diff = (new Date(o.delivered_at).getTime() - new Date(o.created_at).getTime()) / 1000
      if (diff > 0) { sum += diff; n++ }
    }
    return n ? sum / n : null
  }, [today])
  const revenueToday = useMemo(
    () => today.filter((o) => o.payment_status === 'paid').reduce((s, o) => s + num(o.total), 0),
    [today],
  )

  // ── Financial summary ─────────────────────────────────────────────────────────
  const financials = useMemo(() => {
    const paid = fin.filter((o) => o.payment_status === 'paid')
    const gross = paid.reduce((s, o) => s + num(o.total), 0)
    const aov = paid.length ? gross / paid.length : 0
    const methods = new Map<string, number>()
    for (const o of paid) {
      const key = (o.payment_method ?? 'other').toLowerCase()
      const label = key === 'cash' ? 'Cash'
        : key === 'card' ? 'Card'
        : key === 'upi' ? 'UPI'
        : key === 'wallet' ? 'Wallet'
        : 'Other'
      methods.set(label, (methods.get(label) ?? 0) + 1)
    }
    const methodDonut = Array.from(methods.entries()).map(([name, value]) => ({ name, value }))
    return { gross, aov, paidCount: paid.length, methodDonut }
  }, [fin])

  const pendingTotal = useMemo(() => pending.reduce((s, o) => s + num(o.total), 0), [pending])

  // ── Menu intelligence ──────────────────────────────────────────────────────────
  const dishName = (id: string | null) => (id && dishCatalog?.get(id)?.name) || 'Unknown dish'

  const mostSoldToday = useMemo(() => {
    const vol = new Map<string, number>()
    for (const o of today) {
      for (const it of o.order_items ?? []) {
        if (!it.dish_id) continue
        vol.set(it.dish_id, (vol.get(it.dish_id) ?? 0) + num(it.quantity))
      }
    }
    let top: { id: string; qty: number } | null = null
    for (const [id, qty] of vol) if (!top || qty > top.qty) top = { id, qty }
    return top
  }, [today])

  const topDishesWeek = useMemo(() => {
    const vol = new Map<string, number>()
    for (const o of week) {
      for (const it of o.order_items ?? []) {
        if (!it.dish_id) continue
        vol.set(it.dish_id, (vol.get(it.dish_id) ?? 0) + num(it.quantity))
      }
    }
    return Array.from(vol.entries())
      .map(([id, qty]) => ({ name: dishName(id), value: qty }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [week, dishCatalog])

  const heatmap = useMemo(() => {
    const grid: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0))
    let max = 0
    for (const o of week) {
      if (!o.created_at) continue
      const d = new Date(o.created_at)
      grid[d.getDay()][d.getHours()]++
      if (grid[d.getDay()][d.getHours()] > max) max = grid[d.getDay()][d.getHours()]
    }
    return { grid, max }
  }, [week])

  // ── Operations ──────────────────────────────────────────────────────────────────
  const statusDonut = useMemo(() => {
    const counts: Record<string, number> = { pending: 0, preparing: 0, ready: 0, delivered: 0 }
    for (const o of today) if (o.status && o.status in counts) counts[o.status]++
    return [
      { name: 'Pending', value: counts.pending },
      { name: 'Cooking', value: counts.preparing },
      { name: 'Ready', value: counts.ready },
      { name: 'Delivered', value: counts.delivered },
    ].filter((d) => d.value > 0)
  }, [today])

  const staffPerformance = useMemo(() => {
    const taken = new Map<string, number>()
    const paid = new Map<string, number>()
    for (const o of today) {
      if (o.taken_by) taken.set(o.taken_by, (taken.get(o.taken_by) ?? 0) + 1)
      if (o.paid_by && o.payment_status === 'paid') paid.set(o.paid_by, (paid.get(o.paid_by) ?? 0) + 1)
    }
    return staff
      .filter((s) => s.role !== 'chef')
      .map((s) => ({ id: s.id, name: s.name, taken: taken.get(s.id) ?? 0, paid: paid.get(s.id) ?? 0 }))
      .sort((a, b) => b.taken - a.taken)
  }, [staff, today])

  const kitchenLoad = useMemo(() => {
    const byHour = new Array(24).fill(0)
    for (const o of today) {
      if (!o.created_at) continue
      byHour[new Date(o.created_at).getHours()]++
    }
    // Trim to the active part of the day (first order → last order) for a tighter chart.
    let first = 0, last = 23
    while (first < 23 && byHour[first] === 0) first++
    while (last > first && byHour[last] === 0) last--
    return Array.from({ length: last - first + 1 }, (_, i) => ({
      label: hourLabel(first + i),
      orders: byHour[first + i],
    }))
  }, [today])

  const hasToday = today.length > 0

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900">Overview</h1>
        <p className="mt-0.5 text-sm text-gray-500">{restaurant?.name ?? 'Your restaurant'} · today at a glance</p>
      </div>

      {/* ── Live status cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <LiveCard icon="🟢" label="Active Orders" value={activeOrders} accent={activeOrders > 0 ? 'text-[#FF5722]' : undefined} />
        <LiveCard icon="👨‍🍳" label="Staff On Duty" value={staffOnDuty} />
        <LiveCard icon="⏳" label="Avg Wait Today" value={formatDuration(avgWaitSecs)} />
        <LiveCard icon="💰" label="Revenue Today" value={formatINR(revenueToday)} accent="text-green-600" />
      </div>

      {/* ── Financial summary ──────────────────────────────────────────────── */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">Financial Summary</h2>
          <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
            {(['today', 'week', 'month'] as FinRange[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setFinRange(r)}
                className={[
                  'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                  finRange === r ? 'bg-white text-[#FF5722] shadow-sm' : 'text-gray-500 hover:text-gray-700',
                ].join(' ')}
              >
                {FIN_RANGE_LABELS[r]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Gross Revenue</p>
            <p className="mt-1 text-2xl font-black text-gray-900">{formatINR(financials.gross)}</p>
            <p className="mt-0.5 text-xs text-gray-400">{financials.paidCount} paid orders</p>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">Pending Payments</p>
            <p className="mt-1 text-2xl font-black text-amber-700">{formatINR(pendingTotal)}</p>
            <div className="mt-0.5 flex items-center justify-between">
              <p className="text-xs text-amber-600">{pending.length} unpaid order{pending.length === 1 ? '' : 's'}</p>
              <button
                type="button"
                onClick={() => navigate('/dashboard/orders')}
                className="rounded-lg bg-amber-500 px-2.5 py-1 text-xs font-bold text-white hover:bg-amber-600"
              >
                View
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Avg Order Value</p>
            <p className="mt-1 text-2xl font-black text-gray-900">{formatINR(financials.aov)}</p>
            <p className="mt-0.5 text-xs text-gray-400">{FIN_RANGE_LABELS[finRange]}</p>
          </div>

          <Card title="Payment Methods">
            {financials.methodDonut.length === 0 ? (
              <div className="flex h-32 items-center justify-center text-center text-xs text-gray-400">No payments yet.</div>
            ) : (
              <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={financials.methodDonut} dataKey="value" nameKey="name" innerRadius={32} outerRadius={56} paddingAngle={2}>
                      {financials.methodDonut.map((_, i) => (
                        <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* ── Pending payments — cash collection ─────────────────────────────── */}
      {pending.length > 0 && (
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-gray-900">
            Pending Payments
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
              {pending.length}
            </span>
          </h2>
          <div className="overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm">
            <div className="max-h-72 divide-y divide-gray-100 overflow-y-auto">
              {pending.map((o) => (
                <div key={o.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900">
                      {o.token_number != null ? `Token #${o.token_number}` : 'Order'}
                      <span className="ml-2 font-normal text-gray-500">
                        {o.table_id ? `Table ${tableMap?.get(o.table_id) ?? ''}`.trim() : 'Takeaway'}
                      </span>
                    </p>
                    <p className="text-xs text-gray-400">
                      {o.created_at ? new Date(o.created_at).toLocaleString('en-IN', {
                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                      }) : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-sm font-black text-gray-900">{formatINR(num(o.total))}</span>
                    <button
                      type="button"
                      onClick={() => markCashPaid(o.id)}
                      disabled={markingId === o.id}
                      className="whitespace-nowrap rounded-lg bg-green-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-green-700 disabled:opacity-60"
                    >
                      {markingId === o.id ? 'Saving…' : '💵 Mark as Cash Paid'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Menu intelligence ──────────────────────────────────────────────── */}
      <div>
        <h2 className="mb-3 text-base font-bold text-gray-900">Menu Intelligence</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card title="🏆 Most Sold Today">
            {mostSoldToday ? (
              <div className="flex items-center gap-3">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gray-100">
                  {dishCatalog?.get(mostSoldToday.id)?.photo_url ? (
                    <img src={dishCatalog.get(mostSoldToday.id)!.photo_url!} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-2xl">🍽️</span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-lg font-black text-gray-900">{dishName(mostSoldToday.id)}</p>
                  <p className="text-sm text-gray-400">{mostSoldToday.qty} sold today</p>
                </div>
              </div>
            ) : (
              <div className="flex h-16 items-center text-sm text-gray-400">No sales yet today.</div>
            )}
          </Card>

          <Card title="📈 Top 5 Dishes This Week">
            {topDishesWeek.length === 0 ? (
              <Empty message="No sales this week yet." />
            ) : (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topDishesWeek} layout="vertical" margin={{ top: 0, right: 16, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10, fill: '#475569' }} />
                    <Tooltip cursor={{ fill: '#fff7ed' }} />
                    <Bar dataKey="value" fill={ACCENT} radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          <Card title="🔥 Peak Hours (This Week)">
            <div className="overflow-x-auto">
              <div className="min-w-[420px]">
                <div className="mb-1 flex pl-8">
                  {Array.from({ length: 24 }, (_, h) => (
                    <div key={h} className="flex-1 text-center text-[8px] text-gray-400">
                      {h % 6 === 0 ? hourLabel(h) : ''}
                    </div>
                  ))}
                </div>
                {heatmap.grid.map((row, day) => (
                  <div key={day} className="mb-0.5 flex items-center">
                    <div className="w-8 text-[10px] font-medium text-gray-500">{DAYS[day]}</div>
                    {row.map((count, hour) => {
                      const bucket = count === 0 ? 0 : Math.min(5, Math.ceil((count / (heatmap.max || 1)) * 5))
                      return (
                        <div key={hour} className="flex-1 px-px">
                          <div
                            className={`h-3.5 rounded-sm ${HEAT_CLASSES[bucket]}`}
                            title={`${DAYS[day]} ${hourLabel(hour)} — ${count} order${count === 1 ? '' : 's'}`}
                          />
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* ── Operations ─────────────────────────────────────────────────────── */}
      <div>
        <h2 className="mb-3 text-base font-bold text-gray-900">Operations</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card title="Orders by Status (Today)">
            {statusDonut.length === 0 ? (
              <Empty message="No orders yet today." />
            ) : (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusDonut} dataKey="value" nameKey="name" innerRadius={50} outerRadius={84} paddingAngle={2}>
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
          </Card>

          <Card title="Staff Performance (Today)">
            {staffPerformance.length === 0 ? (
              <Empty message="No staff to show." />
            ) : (
              <div className="overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-gray-400">
                      <th className="pb-2 font-semibold">Name</th>
                      <th className="pb-2 text-center font-semibold">Orders</th>
                      <th className="pb-2 text-center font-semibold">Payments</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {staffPerformance.map((s) => (
                      <tr key={s.id}>
                        <td className="py-2 font-medium text-gray-800">{s.name}</td>
                        <td className="py-2 text-center text-gray-600">{s.taken}</td>
                        <td className="py-2 text-center text-gray-600">{s.paid}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title="Kitchen Load (Today)">
            {!hasToday ? (
              <Empty message="No orders yet today." />
            ) : (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={kitchenLoad} margin={{ top: 5, right: 10, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
                    <Tooltip cursor={{ fill: '#fff7ed' }} />
                    <Bar dataKey="orders" fill={ACCENT} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* ── Quick actions ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => navigate('/dashboard/orders')}
          className="rounded-xl bg-[#FF5722] px-5 py-3 text-sm font-bold text-white hover:opacity-90"
        >
          View Live Orders
        </button>
        <button
          type="button"
          onClick={() => navigate('/dashboard/menu')}
          className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50"
        >
          Manage Menu
        </button>
        <button
          type="button"
          onClick={() => downloadTodayCSV(today, tableMap)}
          disabled={today.length === 0}
          className="rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          ⬇ Download Today's Report
        </button>
      </div>
    </div>
  )
}
