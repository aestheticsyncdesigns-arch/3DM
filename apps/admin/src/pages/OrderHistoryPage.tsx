import { Fragment, useMemo, useState } from 'react'
import { useRestaurant } from '../hooks/useRestaurant'
import { useOrderHistory, type HistoryOrder } from '../hooks/useOrderHistory'
import { useDishCatalog } from '../hooks/useOverview'
import { useTableMap, formatINR } from '../hooks/useAnalytics'
import { openBill } from '../lib/bill'

// ─── Helpers ────────────────────────────────────────────────────────────────

const num = (n: number | null | undefined) => Number(n) || 0

function ymd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  pending:   { label: 'Pending',   cls: 'bg-amber-100 text-amber-700' },
  preparing: { label: 'Cooking',   cls: 'bg-orange-100 text-orange-700' },
  ready:     { label: 'Ready',     cls: 'bg-green-100 text-green-700' },
  delivered: { label: 'Served',    cls: 'bg-gray-100 text-gray-600' },
}

const STATUS_OPTIONS = [
  { value: 'all',       label: 'All statuses' },
  { value: 'pending',   label: 'Pending' },
  { value: 'preparing', label: 'Cooking' },
  { value: 'ready',     label: 'Ready' },
  { value: 'delivered', label: 'Delivered' },
]

const PAYMENT_OPTIONS = [
  { value: 'all',    label: 'All payments' },
  { value: 'paid',   label: 'Paid' },
  { value: 'unpaid', label: 'Unpaid' },
]

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  cash: 'Cash', card: 'Card', upi: 'UPI', wallet: 'Wallet',
}

// ─── CSV ────────────────────────────────────────────────────────────────────

function csvCell(v: string | number): string {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// ─── Icons ──────────────────────────────────────────────────────────────────

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-90' : ''}`}
      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    >
      <polyline points="9 18 15 12 9 6" />
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

// ─── Page ───────────────────────────────────────────────────────────────────

export default function OrderHistoryPage() {
  const { restaurant } = useRestaurant()
  const restaurantId = restaurant?.id

  // Default window: last 30 days through today (local-day boundaries).
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return ymd(d)
  })
  const [toDate, setToDate] = useState(() => ymd(new Date()))
  const [search, setSearch]   = useState('')
  const [statusF, setStatusF] = useState('all')
  const [payF, setPayF]       = useState('all')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [billBusy, setBillBusy] = useState<string | null>(null)

  const fromISO = useMemo(() => new Date(`${fromDate}T00:00:00`).toISOString(), [fromDate])
  const toISO   = useMemo(() => new Date(`${toDate}T23:59:59.999`).toISOString(), [toDate])

  const { data: orders = [], isLoading } = useOrderHistory(restaurantId, fromISO, toISO)
  const { data: dishCatalog } = useDishCatalog(restaurantId)
  const { data: tableMap } = useTableMap(restaurantId)

  const tableLabel = (id: string | null) =>
    id ? (tableMap?.get(id) ? `Table ${tableMap.get(id)}` : 'Table') : 'Takeaway'
  const dishName = (id: string | null) => (id && dishCatalog?.get(id)?.name) || 'Unknown dish'
  const isPaid = (o: HistoryOrder) => o.payment_status === 'paid'
  const gstOf = (o: HistoryOrder) => num(o.cgst_amount) + num(o.sgst_amount)
  const itemCount = (o: HistoryOrder) => o.order_items.reduce((s, i) => s + num(i.quantity), 0)

  // ── Client-side filtering ──────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return orders.filter((o) => {
      if (statusF !== 'all' && o.status !== statusF) return false
      if (payF === 'paid' && !isPaid(o)) return false
      if (payF === 'unpaid' && isPaid(o)) return false
      if (q) {
        const tokenStr = o.token_number != null ? String(o.token_number) : ''
        const tableStr = o.table_id ? (tableMap?.get(o.table_id) ?? '') : ''
        if (!tokenStr.includes(q) && !tableStr.toLowerCase().includes(q)) return false
      }
      return true
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, search, statusF, payF, tableMap])

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  async function handleBill(orderId: string) {
    setBillBusy(orderId)
    try { await openBill(orderId) } catch (e) { alert(e instanceof Error ? e.message : 'Could not open the bill') }
    finally { setBillBusy(null) }
  }

  function exportCSV() {
    const header = [
      'Token', 'Table', 'Items', 'Subtotal', 'GST', 'Total',
      'Payment Status', 'Payment Method', 'Order Status', 'Time',
    ]
    const rows = filtered.map((o) => [
      o.token_number ?? '',
      o.table_id ? `Table ${tableMap?.get(o.table_id) ?? ''}`.trim() : 'Takeaway',
      itemCount(o),
      num(o.subtotal),
      gstOf(o),
      num(o.total),
      isPaid(o) ? 'Paid' : 'Unpaid',
      o.payment_method ? (PAYMENT_METHOD_LABEL[o.payment_method] ?? o.payment_method) : '',
      STATUS_META[o.status ?? '']?.label ?? o.status ?? '',
      o.created_at ? new Date(o.created_at).toLocaleString('en-IN') : '',
    ])
    const csv = [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `order-history-${fromDate}_to_${toDate}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="mx-auto max-w-7xl">
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Order History</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {filtered.length} order{filtered.length === 1 ? '' : 's'} · {fromDate} → {toDate}
          </p>
        </div>
        <button
          type="button"
          onClick={exportCSV}
          disabled={filtered.length === 0}
          className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
        >
          ⬇ Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="mb-4 grid grid-cols-1 gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-1">
          <label className="mb-1 block text-xs font-medium text-gray-500">Search</label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Token or table no."
            aria-label="Search by token or table number"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-[#FF5722] focus:bg-white"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">From</label>
          <input
            type="date" value={fromDate} max={toDate}
            onChange={(e) => setFromDate(e.target.value)}
            aria-label="From date"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-[#FF5722] focus:bg-white"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">To</label>
          <input
            type="date" value={toDate} min={fromDate}
            onChange={(e) => setToDate(e.target.value)}
            aria-label="To date"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-[#FF5722] focus:bg-white"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Status</label>
          <select
            value={statusF}
            onChange={(e) => setStatusF(e.target.value)}
            aria-label="Filter by order status"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-[#FF5722] focus:bg-white"
          >
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Payment</label>
          <select
            value={payF}
            onChange={(e) => setPayF(e.target.value)}
            aria-label="Filter by payment status"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-[#FF5722] focus:bg-white"
          >
            {PAYMENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400">
                <th className="px-4 py-3 font-semibold">Token</th>
                <th className="px-4 py-3 font-semibold">Table</th>
                <th className="px-4 py-3 text-center font-semibold">Items</th>
                <th className="px-4 py-3 text-right font-semibold">Subtotal</th>
                <th className="px-4 py-3 text-right font-semibold">GST</th>
                <th className="px-4 py-3 text-right font-semibold">Total</th>
                <th className="px-4 py-3 font-semibold">Payment</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Time</th>
                <th className="px-4 py-3 font-semibold"><span className="sr-only">Bill</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading && (
                <tr><td colSpan={10} className="px-4 py-16 text-center"><Spinner className="mx-auto h-7 w-7" /></td></tr>
              )}

              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={10} className="px-4 py-16 text-center text-sm text-gray-400">
                  No orders match these filters.
                </td></tr>
              )}

              {!isLoading && filtered.map((o) => {
                const open = expanded.has(o.id)
                const sm = STATUS_META[o.status ?? ''] ?? { label: o.status ?? '—', cls: 'bg-gray-100 text-gray-500' }
                return (
                  <Fragment key={o.id}>
                    <tr
                      onClick={() => toggle(o.id)}
                      className="cursor-pointer hover:bg-gray-50"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <ChevronIcon open={open} />
                          <span className="font-bold text-gray-900">
                            {o.token_number != null ? `#${o.token_number}` : '—'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{tableLabel(o.table_id)}</td>
                      <td className="px-4 py-3 text-center text-gray-600">{itemCount(o)}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{formatINR(num(o.subtotal))}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{formatINR(gstOf(o))}</td>
                      <td className="px-4 py-3 text-right font-bold text-gray-900">{formatINR(num(o.total))}</td>
                      <td className="px-4 py-3">
                        {isPaid(o) ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700">
                            💰 Paid
                            {o.payment_method && (
                              <span className="font-normal text-green-600">
                                · {PAYMENT_METHOD_LABEL[o.payment_method] ?? o.payment_method}
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">Unpaid</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${sm.cls}`}>{sm.label}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-400">
                        {o.created_at ? new Date(o.created_at).toLocaleString('en-IN', {
                          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                        }) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isPaid(o) && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleBill(o.id) }}
                            disabled={billBusy === o.id}
                            className="whitespace-nowrap rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                          >
                            {billBusy === o.id ? 'Opening…' : '🧾 Bill'}
                          </button>
                        )}
                      </td>
                    </tr>

                    {open && (
                      <tr className="bg-gray-50/60">
                        <td colSpan={10} className="px-4 py-3">
                          <div className="rounded-xl border border-gray-100 bg-white p-3">
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Items</p>
                            <ul className="divide-y divide-gray-50">
                              {o.order_items.length === 0 && (
                                <li className="py-1.5 text-sm text-gray-400">No items recorded.</li>
                              )}
                              {o.order_items.map((it, i) => (
                                <li key={i} className="flex items-start justify-between gap-3 py-1.5">
                                  <div className="min-w-0">
                                    <span className="text-sm text-gray-800">
                                      <span className="font-semibold text-gray-900">{num(it.quantity)}×</span>{' '}
                                      {dishName(it.dish_id)}
                                    </span>
                                    {it.notes && (
                                      <p className="text-xs italic text-amber-600">“{it.notes}”</p>
                                    )}
                                  </div>
                                  <div className="shrink-0 text-right text-sm text-gray-600">
                                    {formatINR(num(it.price))}
                                    <span className="ml-2 text-xs text-gray-400">
                                      = {formatINR(num(it.price) * num(it.quantity))}
                                    </span>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
