import { useTables } from '../hooks/useTables'
import { useTableStatuses, type TableState } from '../hooks/useTableStatuses'

interface Props {
  restaurantId: string
  selectedTableId: string | null
  onPickTable: (id: string) => void
}

const STATE_META: Record<TableState, { label: string; card: string; badge: string }> = {
  free: {
    label: 'Free',
    card: 'border-gray-200 bg-white hover:border-gray-300',
    badge: 'bg-gray-100 text-gray-500',
  },
  occupied: {
    label: 'Occupied',
    card: 'border-blue-200 bg-blue-50 hover:border-blue-300',
    badge: 'bg-blue-100 text-blue-700',
  },
  awaiting_payment: {
    label: 'Awaiting Payment',
    card: 'border-amber-300 bg-amber-50 ring-1 ring-amber-200 hover:border-amber-400',
    badge: 'bg-amber-200 text-amber-800',
  },
}

export default function TablesTab({ restaurantId, selectedTableId, onPickTable }: Props) {
  const { data: tables = [], isLoading } = useTables(restaurantId)
  const { data: statuses = {} } = useTableStatuses(restaurantId)

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-gray-100" />
        ))}
      </div>
    )
  }

  if (tables.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
        <span className="text-4xl">🪑</span>
        <p className="font-medium text-gray-500">No tables set up yet.</p>
      </div>
    )
  }

  return (
    <div className="p-4">
      {/* Legend */}
      <div className="mb-4 flex flex-wrap gap-3 text-xs font-medium text-gray-500">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-gray-300" /> Free</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-blue-400" /> Occupied</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> Awaiting Payment</span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {tables.map((t) => {
          const info = statuses[t.id]
          const state: TableState = info?.state ?? 'free'
          const meta = STATE_META[state]
          const isSelected = selectedTableId === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onPickTable(t.id)}
              className={[
                'flex flex-col items-center gap-2 rounded-2xl border p-4 text-center shadow-sm transition-all active:scale-[0.98]',
                meta.card,
                isSelected ? 'outline outline-2 outline-[#FF5722]' : '',
              ].join(' ')}
            >
              <span className="text-2xl font-black text-gray-900">{t.number}</span>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${meta.badge}`}>
                {meta.label}
              </span>
              {info && info.activeCount > 0 && (
                <span className="text-[11px] text-gray-500">
                  {info.activeCount} active order{info.activeCount === 1 ? '' : 's'}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
