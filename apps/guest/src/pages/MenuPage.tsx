import { useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useRestaurant } from '../hooks/useRestaurant'
import { useMenu } from '../hooks/useMenu'
import { useCart } from '../context/CartContext'
import { trackMenuView } from '../lib/analytics'
import MenuHeader from '../components/MenuHeader'
import CategoryTabs from '../components/CategoryTabs'
import DishCard from '../components/DishCard'
import WaiterCallButton from '../components/WaiterCallButton'
import { supabase } from '../lib/supabase'

function SkeletonCard() {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-white p-3 shadow-sm animate-pulse">
      <div className="flex-1 pt-1">
        <div className="mb-2 h-3 w-12 rounded bg-gray-200" />
        <div className="mb-1.5 h-4 w-3/4 rounded bg-gray-200" />
        <div className="mb-2 h-3 w-1/3 rounded bg-gray-200" />
        <div className="mb-1 h-3 w-full rounded bg-gray-200" />
        <div className="mb-2 h-3 w-2/3 rounded bg-gray-200" />
        <div className="h-5 w-16 rounded bg-gray-200" />
      </div>
      <div className="h-[100px] w-[100px] shrink-0 rounded-xl bg-gray-200" />
    </div>
  )
}

function SkeletonSection() {
  return (
    <section className="mb-10">
      <div className="mb-3 h-5 w-32 animate-pulse rounded bg-gray-300" />
      <div className="flex flex-col gap-5">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </section>
  )
}

// ─── Dev-only table selector ──────────────────────────────────────────────────
// Lets developers test table-attributed orders without scanning a QR code.
// Rendered only when import.meta.env.DEV — tree-shaken out of production builds.

const DEV_TABLE_KEY = 'guest_table_id'

function DevTableSelector({
  restaurantId,
  tableId,
  onSelect,
}: {
  restaurantId: string
  tableId: string | null
  onSelect: (id: string) => void
}) {
  const [tables, setTables] = useState<{ id: string; number: string }[]>([])
  const [open, setOpen]     = useState(false)

  useEffect(() => {
    supabase
      .from('tables')
      .select('id, number')
      .eq('restaurant_id', restaurantId)
      .eq('is_active', true)
      .order('number', { ascending: true })
      .then(({ data }) => setTables(data ?? []))
  }, [restaurantId])

  const selected = tables.find(t => t.id === tableId)

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!open) return
    function close(e: MouseEvent) {
      if (!(e.target as Element).closest('[data-dev-selector]')) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  if (selected) {
    return (
      <span className="rounded-full border border-[#FF5722] bg-white/90 px-3 py-1 text-xs font-bold text-[#FF5722] shadow-sm">
        📍 Table {selected.number}
      </span>
    )
  }

  return (
    <div data-dev-selector className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="rounded-full border border-orange-300 bg-white/90 px-3 py-1 text-xs font-semibold text-orange-500 shadow-sm"
      >
        Select Table ▾
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-[140px] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
          {tables.length === 0 && (
            <p className="px-4 py-2 text-xs text-gray-400">No tables found</p>
          )}
          {tables.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => { onSelect(t.id); setOpen(false) }}
              className="block w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50"
            >
              Table {t.number}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

export default function MenuPage() {
  const { subdomain } = useParams<{ subdomain: string }>()
  const [searchParams, setSearchParams] = useSearchParams()

  // URL param is the primary source; sessionStorage is the dev fallback so a
  // page refresh doesn't lose the selected table during local testing.
  const urlTableId = searchParams.get('table')
  const tableId = urlTableId ?? (
    import.meta.env.DEV ? sessionStorage.getItem(DEV_TABLE_KEY) : null
  )

  function handleDevTableSelect(id: string) {
    sessionStorage.setItem(DEV_TABLE_KEY, id)
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.set('table', id)
      return next
    }, { replace: true })
  }
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const stickyRef = useRef<HTMLDivElement>(null)
  const menuViewTracked = useRef(false)

  const { setOrderContext } = useCart()

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setCollapsed(!entry.isIntersecting),
      { threshold: 0 },
    )
    if (sentinelRef.current) observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [])

  const restaurant = useRestaurant(subdomain ?? '')
  const menu = useMenu(restaurant.data?.id)

  useEffect(() => {
    if (restaurant.data?.id) {
      setOrderContext(restaurant.data.id, tableId)
    }
  }, [restaurant.data?.id, tableId])

  // Fire menu_view once per page load (ref guards against StrictMode double-run).
  useEffect(() => {
    if (!restaurant.data?.id || menuViewTracked.current) return
    menuViewTracked.current = true
    trackMenuView(restaurant.data.id, tableId)
  }, [restaurant.data?.id, tableId])

  function handleCategorySelect(id: string) {
    setActiveCategory(id)
    // Measure current sticky height so the section clears it exactly
    const stickyHeight = stickyRef.current?.getBoundingClientRect().height ?? 260
    const section = document.getElementById(`category-${id}`)
    if (section) {
      const top = section.getBoundingClientRect().top + window.scrollY - stickyHeight - 8
      window.scrollTo({ top, behavior: 'smooth' })
    }
  }

  // Full page skeleton while the restaurant row is in flight
  if (restaurant.isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="h-52 w-full animate-pulse bg-gray-300" />
        <div className="flex gap-2 bg-white px-3 py-2 shadow-sm">
          <div className="h-7 w-20 animate-pulse rounded-full bg-gray-200" />
          <div className="h-7 w-[72px] animate-pulse rounded-full bg-gray-200" />
          <div className="h-7 w-24 animate-pulse rounded-full bg-gray-200" />
        </div>
        <main className="px-4 pb-32 pt-4">
          <SkeletonSection />
          <SkeletonSection />
        </main>
      </div>
    )
  }

  // Subdomain not found
  if (restaurant.error || !restaurant.data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-gray-50 px-6 text-center">
        <span className="text-5xl">🔍</span>
        <p className="text-lg font-semibold text-gray-800">Restaurant not found.</p>
        <p className="text-sm text-gray-500">Please check the QR code and try again.</p>
      </div>
    )
  }

  const categories = menu.data ?? []
  const activeCategoryId = activeCategory ?? categories[0]?.id ?? null

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 1px sentinel — IntersectionObserver fires on any scroll */}
      <div ref={sentinelRef} className="h-px" />

      {/* Unified sticky container so header + tabs collapse as a unit */}
      <div ref={stickyRef} className="relative sticky top-0 z-30 w-full">
        <MenuHeader restaurant={restaurant.data} collapsed={collapsed} />
        {import.meta.env.DEV && restaurant.data?.id && (
          <div className="absolute right-3 top-3 z-10">
            <DevTableSelector
              restaurantId={restaurant.data.id}
              tableId={tableId}
              onSelect={handleDevTableSelect}
            />
          </div>
        )}
        {!menu.isLoading && categories.length > 0 && (
          <CategoryTabs
            categories={categories}
            activeId={activeCategoryId}
            onSelect={handleCategorySelect}
          />
        )}
      </div>

      <WaiterCallButton restaurantId={restaurant.data.id} tableId={tableId} />

      <main className="px-4 pb-32 pt-4">
        {/* Skeleton while menu rows are fetching */}
        {menu.isLoading && (
          <>
            <SkeletonSection />
            <SkeletonSection />
          </>
        )}

        {/* Empty state */}
        {!menu.isLoading && categories.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <span className="text-4xl">🍽️</span>
            <p className="font-medium text-gray-600">No dishes available yet.</p>
            <p className="text-sm text-gray-400">Check back soon!</p>
          </div>
        )}

        {/* Category sections */}
        {categories.map((category) => (
          <section
            key={category.id}
            id={`category-${category.id}`}
            className="mb-10 scroll-mt-64"
          >
            <h2 className="mb-3 flex items-center gap-2 text-[18px] font-bold text-gray-900">
              {category.icon && <span className="text-xl">{category.icon}</span>}
              {category.name}
            </h2>

            <div className="flex flex-col gap-5">
              {category.dishes.map((dish) => (
                <DishCard
                  key={dish.id}
                  dish={dish}
                  restaurantId={restaurant.data.id}
                  tableId={tableId}
                />
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  )
}
