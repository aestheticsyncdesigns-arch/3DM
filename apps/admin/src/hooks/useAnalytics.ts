import { useQuery } from '@tanstack/react-query'
import { supabase } from '../supabase'

// ─── Types ──────────────────────────────────────────────────────────────────

export type TimeRange = 'today' | 'week' | 'month' | 'all'

export interface OrderItemLite {
  dish_id: string | null
  quantity: number
  price: number
}

export interface OrderWithItems {
  id: string
  total: number | null
  status: string | null
  created_at: string | null
  table_id: string | null
  preparing_at: string | null
  ready_at: string | null
  delivered_at: string | null
  order_items: OrderItemLite[]
}

export interface AnalyticsEventLite {
  id: string
  event_type: string
  dish_id: string | null
  created_at: string | null
  metadata: Record<string, unknown> | null
}

export interface DishLite {
  name: string
  price: number
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/** Start-of-range cutoff. `all` returns null (no lower bound). */
export function rangeCutoff(range: TimeRange): Date | null {
  const now = new Date()
  if (range === 'today') {
    const d = new Date(now)
    d.setHours(0, 0, 0, 0)
    return d
  }
  if (range === 'week') {
    const d = new Date(now)
    d.setDate(d.getDate() - 6)
    d.setHours(0, 0, 0, 0)
    return d
  }
  if (range === 'month') {
    const d = new Date(now)
    d.setDate(1)
    d.setHours(0, 0, 0, 0)
    return d
  }
  return null
}

export const RANGE_LABELS: Record<TimeRange, string> = {
  today: 'Today',
  week: 'This Week',
  month: 'This Month',
  all: 'All Time',
}

/** Classify a device from its user-agent string. */
export function detectDevice(ua: unknown): 'iOS' | 'Android' | 'Desktop' {
  if (typeof ua !== 'string') return 'Desktop'
  const s = ua.toLowerCase()
  if (/iphone|ipad|ipod/.test(s)) return 'iOS'
  if (/android/.test(s)) return 'Android'
  return 'Desktop'
}

export function formatINR(n: number): string {
  return '₹' + Math.round(n || 0).toLocaleString('en-IN')
}

/** Seconds → "Xm Ys" / "Ys", or em-dash when unavailable. */
export function formatDuration(seconds: number | null): string {
  if (seconds == null || !isFinite(seconds) || seconds <= 0) return '—'
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return m === 0 ? `${s}s` : `${m}m ${s}s`
}

// ─── Query hooks ──────────────────────────────────────────────────────────────

/**
 * Orders (with their line items) for the restaurant within the range.
 * Uses `select('*')` so it keeps working before migration 015 adds the
 * transition-timestamp columns — they simply read back as undefined.
 */
export function useRangeOrders(restaurantId: string | undefined, range: TimeRange) {
  return useQuery<OrderWithItems[]>({
    queryKey: ['analytics', 'orders', restaurantId, range],
    queryFn: async () => {
      if (!restaurantId) return []
      let q = supabase
        .from('orders')
        .select('*, order_items(dish_id, quantity, price)')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: true })

      const cutoff = rangeCutoff(range)
      if (cutoff) q = q.gte('created_at', cutoff.toISOString())

      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as unknown as OrderWithItems[]
    },
    enabled: !!restaurantId,
    staleTime: 60_000,
  })
}

/** Currently-active orders (not delivered) — for the live status donut + pending count. */
export function useLiveOrders(restaurantId: string | undefined) {
  return useQuery<{ id: string; status: string | null }[]>({
    queryKey: ['analytics', 'live-orders', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return []
      const { data, error } = await supabase
        .from('orders')
        .select('id, status')
        .eq('restaurant_id', restaurantId)
        .in('status', ['pending', 'preparing', 'ready'])
      if (error) throw error
      return data ?? []
    },
    enabled: !!restaurantId,
    staleTime: 15_000,
    refetchInterval: 30_000,
  })
}

/** Analytics events for the restaurant within the range. */
export function useAnalyticsEvents(restaurantId: string | undefined, range: TimeRange) {
  return useQuery<AnalyticsEventLite[]>({
    queryKey: ['analytics', 'events', restaurantId, range],
    queryFn: async () => {
      if (!restaurantId) return []
      let q = supabase
        .from('analytics_events')
        .select('*')
        .eq('restaurant_id', restaurantId)

      const cutoff = rangeCutoff(range)
      if (cutoff) q = q.gte('created_at', cutoff.toISOString())

      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as unknown as AnalyticsEventLite[]
    },
    enabled: !!restaurantId,
    staleTime: 60_000,
  })
}

/** Map of dish id → { name, price } for the restaurant (menu → category → dish chain). */
export function useDishMap(restaurantId: string | undefined) {
  return useQuery<Map<string, DishLite>>({
    queryKey: ['analytics', 'dishes', restaurantId],
    queryFn: async () => {
      const map = new Map<string, DishLite>()
      if (!restaurantId) return map

      const { data: menus } = await supabase
        .from('menus')
        .select('id')
        .eq('restaurant_id', restaurantId)
      const menuIds = (menus ?? []).map((m) => m.id)
      if (menuIds.length === 0) return map

      const { data: cats } = await supabase
        .from('categories')
        .select('id')
        .in('menu_id', menuIds)
      const catIds = (cats ?? []).map((c) => c.id)
      if (catIds.length === 0) return map

      const { data: dishes } = await supabase
        .from('dishes')
        .select('id, name, price')
        .in('category_id', catIds)
      for (const d of dishes ?? []) {
        map.set(d.id, { name: d.name, price: Number(d.price) || 0 })
      }
      return map
    },
    enabled: !!restaurantId,
    staleTime: 5 * 60_000,
  })
}

/** Map of table id → table number for the restaurant. */
export function useTableMap(restaurantId: string | undefined) {
  return useQuery<Map<string, string>>({
    queryKey: ['analytics', 'tables', restaurantId],
    queryFn: async () => {
      const map = new Map<string, string>()
      if (!restaurantId) return map
      const { data } = await supabase
        .from('tables')
        .select('id, number')
        .eq('restaurant_id', restaurantId)
      for (const t of data ?? []) map.set(t.id, t.number)
      return map
    },
    enabled: !!restaurantId,
    staleTime: 5 * 60_000,
  })
}
