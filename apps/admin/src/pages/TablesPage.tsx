import QRCode from 'qrcode'
import { useEffect, useRef, useState } from 'react'
import type { Database } from '@3dm/shared'
import { supabase } from '../supabase'
import { useRestaurant } from '../hooks/useRestaurant'

// ─── Types ────────────────────────────────────────────────────────────────────

type Table     = Database['public']['Tables']['tables']['Row']
type OrderRow  = Database['public']['Tables']['orders']['Row']

// ─── URL helpers ─────────────────────────────────────────────────────────────

function menuUrl(subdomain: string, tableId: string): string {
  if (import.meta.env.DEV) {
    // Use the current hostname so QR codes work from phones on the same LAN.
    // Admin runs on :5180, guest on :5173 — keep the hostname, swap the port.
    const guestOrigin = `${window.location.protocol}//${window.location.hostname}:5173`
    return `${guestOrigin}/${subdomain}/menu?table=${tableId}`
  }
  return `https://${subdomain}.3dm.in/menu?table=${tableId}`
}

async function generateQrDataUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, { width: 256, margin: 2, color: { dark: '#1a1a1a', light: '#ffffff' } })
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function PlusIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function DownloadIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" /><path d="M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function ChevronRightIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

// ─── Add Tables Modal ─────────────────────────────────────────────────────────

interface AddTablesModalProps {
  nextNumber: number
  onSave:     (count: number, startFrom: number) => Promise<void>
  onClose:    () => void
}

function AddTablesModal({ nextNumber, onSave, onClose }: AddTablesModalProps) {
  const [count,     setCount]     = useState(1)
  const [startFrom, setStartFrom] = useState(nextNumber)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  async function handleSave() {
    if (count < 1 || count > 100) { setError('Enter a number between 1 and 100.'); return }
    if (startFrom < 1)            { setError('Starting number must be at least 1.'); return }
    setSaving(true)
    try { await onSave(count, startFrom) } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add tables.')
      setSaving(false)
    }
  }

  const preview = count === 1
    ? `Table ${startFrom}`
    : `Tables ${startFrom} – ${startFrom + count - 1}`

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Add Tables</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close" title="Close">
            <XIcon />
          </button>
        </div>

        {error && <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

        <div className="space-y-4">
          <div>
            <label htmlFor="table-count" className="mb-1.5 block text-sm font-medium text-gray-700">
              How many tables?
            </label>
            <input
              ref={inputRef}
              id="table-count"
              type="number"
              value={count}
              min={1}
              max={100}
              placeholder="e.g. 5"
              onChange={e => { setCount(Number(e.target.value)); setError('') }}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none focus:border-[#FF5722] focus:bg-white"
            />
          </div>

          <div>
            <label htmlFor="start-number" className="mb-1.5 block text-sm font-medium text-gray-700">
              Starting from table number
            </label>
            <input
              id="start-number"
              type="number"
              value={startFrom}
              min={1}
              placeholder="e.g. 1"
              onChange={e => { setStartFrom(Number(e.target.value)); setError('') }}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none focus:border-[#FF5722] focus:bg-white"
            />
          </div>
        </div>

        {count > 0 && startFrom > 0 && (
          <p className="mt-3 text-center text-xs text-gray-400">
            Will create: <span className="font-semibold text-gray-700">{preview}</span>
          </p>
        )}

        <div className="mt-5 flex gap-3">
          <button type="button" onClick={onClose}
            className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button type="button" onClick={handleSave} disabled={saving}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#FF5722] py-3 text-sm font-bold text-white disabled:opacity-70">
            {saving && <Spinner className="h-4 w-4" />}
            {saving ? 'Creating…' : `Add ${count > 1 ? `${count} Tables` : 'Table'}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Confirm Delete ───────────────────────────────────────────────────────────

function ConfirmDelete({ table, onConfirm, onClose }: {
  table:     Table
  onConfirm: () => Promise<void>
  onClose:   () => void
}) {
  const [deleting, setDeleting] = useState(false)

  async function handleConfirm() {
    setDeleting(true)
    try { await onConfirm() } finally { setDeleting(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="mb-2 text-base font-semibold text-gray-900">Delete Table {table.number}?</h2>
        <p className="mb-5 text-sm text-gray-500">
          This will permanently remove the table and its QR code. Any guest currently scanning it won't be able to order.
        </p>
        <div className="flex gap-3">
          <button type="button" onClick={onClose}
            className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button type="button" onClick={handleConfirm} disabled={deleting}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-500 py-3 text-sm font-bold text-white disabled:opacity-70">
            {deleting && <Spinner className="h-4 w-4" />}
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Table Detail Drawer ──────────────────────────────────────────────────────

interface TableDrawerProps {
  table:      Table
  subdomain:  string
  qrDataUrl:  string
  onClose:    () => void
  onDelete:   () => void
}

function TableDrawer({ table, subdomain, qrDataUrl, onClose, onDelete }: TableDrawerProps) {
  const [orders,    setOrders]    = useState<OrderRow[]>([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    supabase
      .from('orders')
      .select('*')
      .eq('table_id', table.id)
      .in('status', ['pending', 'confirmed', 'preparing', 'ready'])
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setOrders(data ?? [])
        setLoading(false)
      })
  }, [table.id])

  function downloadQr() {
    const link = document.createElement('a')
    link.href = qrDataUrl
    link.download = `table-${table.number}-qr.png`
    link.click()
  }

  const url = menuUrl(subdomain, table.id)

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 flex h-full w-full max-w-sm flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Table {table.number}</h2>
            <span className={[
              'mt-0.5 inline-block rounded-full px-2 py-0.5 text-xs font-semibold',
              table.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500',
            ].join(' ')}>
              {table.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close" title="Close">
            <XIcon />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          {/* QR code */}
          <div className="flex flex-col items-center gap-3">
            <div className="overflow-hidden rounded-2xl border border-gray-200 p-3 shadow-sm">
              <img src={qrDataUrl} alt={`QR code for Table ${table.number}`} className="h-48 w-48" />
            </div>
            <p className="max-w-[240px] break-all text-center text-[11px] text-gray-400">{url}</p>
            <button
              type="button"
              onClick={downloadQr}
              className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              <DownloadIcon /> Download QR
            </button>
          </div>

          {/* Active orders */}
          <div>
            <h3 className="mb-2 text-sm font-semibold text-gray-700">Active Orders</h3>
            {loading && <div className="h-12 animate-pulse rounded-xl bg-gray-100" />}
            {!loading && orders.length === 0 && (
              <p className="rounded-xl bg-gray-50 px-4 py-4 text-center text-sm text-gray-400">
                No active orders at this table
              </p>
            )}
            {!loading && orders.map(order => (
              <div key={order.id} className="mb-2 flex items-center justify-between rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {order.token_number != null ? `#${order.token_number}` : 'Order'}
                  </p>
                  <p className="text-xs text-gray-400 capitalize">{order.status}</p>
                </div>
                {order.total != null && (
                  <p className="text-sm font-bold text-gray-900">₹{order.total}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 px-5 py-4">
          <button
            type="button"
            onClick={onDelete}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 py-3 text-sm font-semibold text-red-500 hover:bg-red-50"
          >
            <TrashIcon /> Delete Table {table.number}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Table Card ───────────────────────────────────────────────────────────────

interface TableCardProps {
  table:    Table
  qrDataUrl: string
  onClick:  () => void
  onDownload: (e: React.MouseEvent) => void
  onDelete:   (e: React.MouseEvent) => void
}

function TableCard({ table, qrDataUrl, onClick, onDownload, onDelete }: TableCardProps) {
  return (
    <div
      onClick={onClick}
      className="group relative flex cursor-pointer flex-col items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all hover:border-[#FF5722] hover:shadow-md"
    >
      {/* Status badge */}
      <div className="absolute right-3 top-3">
        <span className={[
          'rounded-full px-2 py-0.5 text-[10px] font-semibold',
          table.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500',
        ].join(' ')}>
          {table.is_active ? 'Active' : 'Inactive'}
        </span>
      </div>

      {/* Table number */}
      <p className="text-3xl font-black text-gray-900 leading-none">{table.number}</p>

      {/* QR code */}
      <div className="overflow-hidden rounded-xl border border-gray-100 p-1.5">
        <img
          src={qrDataUrl}
          alt={`QR code for Table ${table.number}`}
          className="h-[88px] w-[88px]"
          draggable={false}
        />
      </div>

      {/* Action row */}
      <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
        <button
          type="button"
          onClick={onDownload}
          title="Download QR code"
          aria-label={`Download QR code for Table ${table.number}`}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-700"
        >
          <DownloadIcon />
        </button>
        <button
          type="button"
          onClick={onDelete}
          title="Delete table"
          aria-label={`Delete Table ${table.number}`}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:border-red-200 hover:text-red-500"
        >
          <TrashIcon />
        </button>
        <ChevronRightIcon />
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TablesPage() {
  const { restaurant, isLoading: restaurantLoading } = useRestaurant()

  const [tables,       setTables]       = useState<Table[]>([])
  const [qrMap,        setQrMap]        = useState<Record<string, string>>({}) // tableId → dataUrl
  const [isLoading,    setIsLoading]    = useState(true)
  const [error,        setError]        = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Table | null>(null)
  const [drawerTable,  setDrawerTable]  = useState<Table | null>(null)
  const [dlAllBusy,    setDlAllBusy]    = useState(false)

  // ── Fetch tables ────────────────────────────────────────────────────────────
  async function fetchTables(restId: string) {
    setIsLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('tables')
      .select('*')
      .eq('restaurant_id', restId)
      .order('number', { ascending: true })

    if (err) { setError(err.message); setIsLoading(false); return }
    const rows = data ?? []
    setTables(rows)
    setIsLoading(false)
    void generateQrCodes(rows)
  }

  // ── Generate QR data-URLs for all tables ────────────────────────────────────
  async function generateQrCodes(rows: Table[]) {
    if (!restaurant) return
    const entries = await Promise.all(
      rows.map(async t => {
        const url = menuUrl(restaurant.subdomain, t.id)
        const dataUrl = await generateQrDataUrl(url)
        return [t.id, dataUrl] as const
      })
    )
    setQrMap(Object.fromEntries(entries))
  }

  useEffect(() => {
    if (!restaurant?.id) return
    void fetchTables(restaurant.id)
  }, [restaurant?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Add tables ──────────────────────────────────────────────────────────────
  async function handleAddTables(count: number, startFrom: number) {
    if (!restaurant?.id) return
    const rows = Array.from({ length: count }, (_, i) => ({
      restaurant_id: restaurant.id,
      number:        String(startFrom + i),
      is_active:     true,
    }))
    const { error: err } = await supabase.from('tables').insert(rows)
    if (err) throw new Error(err.message)
    setShowAddModal(false)
    await fetchTables(restaurant.id)
  }

  // ── Delete table ────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!deleteTarget || !restaurant?.id) return
    const { error: err } = await supabase.from('tables').delete().eq('id', deleteTarget.id)
    if (err) { setError(err.message); return }
    setDeleteTarget(null)
    setDrawerTable(null)
    await fetchTables(restaurant.id)
  }

  // ── Download single QR ──────────────────────────────────────────────────────
  function downloadQr(table: Table) {
    const dataUrl = qrMap[table.id]
    if (!dataUrl) return
    const link = document.createElement('a')
    link.href = dataUrl
    link.download = `table-${table.number}-qr.png`
    link.click()
  }

  // ── Download all QRs ────────────────────────────────────────────────────────
  async function handleDownloadAll() {
    if (tables.length === 0 || !restaurant) return
    setDlAllBusy(true)
    try {
      // Download them sequentially as individual PNGs (no zip dependency needed)
      for (const table of tables) {
        const url     = menuUrl(restaurant.subdomain, table.id)
        const dataUrl = qrMap[table.id] ?? await generateQrDataUrl(url)
        const link    = document.createElement('a')
        link.href     = dataUrl
        link.download = `table-${table.number}-qr.png`
        link.click()
        // Small delay so the browser doesn't block rapid programmatic downloads
        await new Promise(r => setTimeout(r, 150))
      }
    } finally {
      setDlAllBusy(false)
    }
  }

  // ── Next available table number ──────────────────────────────────────────────
  const nextNumber = tables.length > 0
    ? Math.max(...tables.map(t => Number(t.number) || 0)) + 1
    : 1

  if (restaurantLoading || isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  return (
    <div>
      {/* Page header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Tables & QR Codes</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {tables.length > 0
              ? `${tables.length} table${tables.length === 1 ? '' : 's'} · Tap a card to view orders`
              : 'Add tables to generate QR codes for your guests'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {tables.length > 0 && (
            <button
              type="button"
              onClick={handleDownloadAll}
              disabled={dlAllBusy}
              className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
            >
              {dlAllBusy ? <Spinner className="h-4 w-4" /> : <DownloadIcon />}
              Download All QRs
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 rounded-xl bg-[#FF5722] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90"
          >
            <PlusIcon /> Add Tables
          </button>
        </div>
      </div>

      {error && <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

      {/* Empty state */}
      {tables.length === 0 && !isLoading && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white py-20">
          <span className="mb-3 text-5xl">🪑</span>
          <p className="text-sm font-medium text-gray-500">No tables yet</p>
          <p className="mt-1 text-xs text-gray-400">Add tables to get QR codes you can print for guests</p>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="mt-5 flex items-center gap-2 rounded-xl bg-[#FF5722] px-4 py-2.5 text-sm font-semibold text-white"
          >
            <PlusIcon /> Add Tables
          </button>
        </div>
      )}

      {/* Table grid */}
      {tables.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {tables.map(table => (
            <TableCard
              key={table.id}
              table={table}
              qrDataUrl={qrMap[table.id] ?? ''}
              onClick={() => setDrawerTable(table)}
              onDownload={e => { e.stopPropagation(); downloadQr(table) }}
              onDelete={e => { e.stopPropagation(); setDeleteTarget(table) }}
            />
          ))}
        </div>
      )}

      {/* QR placeholder shimmer while QRs generate */}
      {tables.length > 0 && Object.keys(qrMap).length < tables.length && (
        <p className="mt-3 text-center text-xs text-gray-400">Generating QR codes…</p>
      )}

      {/* Modals */}
      {showAddModal && (
        <AddTablesModal
          nextNumber={nextNumber}
          onSave={handleAddTables}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {deleteTarget && (
        <ConfirmDelete
          table={deleteTarget}
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)}
        />
      )}

      {drawerTable && restaurant && (
        <TableDrawer
          table={drawerTable}
          subdomain={restaurant.subdomain}
          qrDataUrl={qrMap[drawerTable.id] ?? ''}
          onClose={() => setDrawerTable(null)}
          onDelete={() => { setDrawerTable(null); setDeleteTarget(drawerTable) }}
        />
      )}
    </div>
  )
}
