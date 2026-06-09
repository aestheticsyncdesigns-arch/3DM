import { useMemo, useState } from 'react'
import { useStaffMenu } from '../hooks/useStaffMenu'
import type { Dish } from '../types'

interface Props {
  restaurantId: string
  onAdd: (dish: Dish) => void
}

type VegFilter = 'all' | 'veg' | 'nonveg'

function VegDot({ isVeg }: { isVeg: boolean }) {
  const color = isVeg ? '#00a550' : '#e40000'
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="shrink-0">
      <rect x="0.5" y="0.5" width="15" height="15" rx="1.5" stroke={color} strokeWidth="1.5" fill="white" />
      <circle cx="8" cy="8" r="4.5" fill={color} />
    </svg>
  )
}

export default function MenuBrowser({ restaurantId, onAdd }: Props) {
  const { data: categories, isLoading } = useStaffMenu(restaurantId)
  const [search, setSearch] = useState('')
  const [veg, setVeg] = useState<VegFilter>('all')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (categories ?? [])
      .map((cat) => ({
        ...cat,
        dishes: cat.dishes.filter((d) => {
          // Out of Stock dishes are hidden from the waiter entirely.
          if (d.is_available === false) return false
          const matchesSearch = !q || d.name.toLowerCase().includes(q)
          const isVeg = d.is_veg ?? true
          const matchesVeg =
            veg === 'all' || (veg === 'veg' ? isVeg : !isVeg)
          return matchesSearch && matchesVeg
        }),
      }))
      .filter((cat) => cat.dishes.length > 0)
  }, [categories, search, veg])

  const FILTERS: { key: VegFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'veg', label: 'Veg' },
    { key: 'nonveg', label: 'Non-veg' },
  ]

  return (
    <div className="flex h-full flex-col">
      {/* Search + filter bar */}
      <div className="border-b border-gray-200 bg-white px-4 py-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search dishes…"
          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-[#FF5722] focus:bg-white"
        />
        <div className="mt-2 flex gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setVeg(f.key)}
              className={[
                'rounded-full px-4 py-1.5 text-sm font-semibold transition-colors',
                veg === f.key
                  ? 'bg-[#FF5722] text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
              ].join(' ')}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Dish list */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {isLoading && (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-100" />
            ))}
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <span className="text-4xl">🔍</span>
            <p className="font-medium text-gray-500">No dishes match.</p>
          </div>
        )}

        {filtered.map((cat) => (
          <section key={cat.id} className="mb-6">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-gray-500">
              {cat.icon && <span>{cat.icon}</span>}
              {cat.name}
            </h2>
            <div className="flex flex-col gap-2">
              {cat.dishes.map((dish) => {
                const available = dish.is_available !== false
                return (
                  <button
                    key={dish.id}
                    type="button"
                    disabled={!available}
                    onClick={() => onAdd(dish)}
                    className={[
                      'flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-3 text-left shadow-sm transition-all',
                      available
                        ? 'hover:border-[#FF5722]/40 hover:shadow active:scale-[0.99]'
                        : 'cursor-not-allowed opacity-50',
                    ].join(' ')}
                  >
                    <VegDot isVeg={dish.is_veg ?? true} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold leading-tight text-gray-900">
                        {dish.name}
                      </p>
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-gray-500">₹ {dish.price}</p>
                        {dish.stock_note && (
                          <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                            {dish.stock_note}
                          </span>
                        )}
                      </div>
                    </div>
                    {available ? (
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FF5722] text-xl font-bold text-white">
                        +
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full bg-gray-200 px-2 py-1 text-xs font-semibold text-gray-500">
                        Sold Out
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
