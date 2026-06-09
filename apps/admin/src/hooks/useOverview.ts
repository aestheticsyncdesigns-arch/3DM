import { useQuery } from '@tanstack/react-query'
import { supabase } from '../supabase'

// ─── Helpers ──────────────────────────────────────────────────────────────────

export type FinRange = 'today' | 'week' | 'month'

export const FIN_RANGE_LABELS: Record<FinRange, string> = {
  today: 'Today',
  week: 'This Week',
  month: 'This Month',
}

export function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export function finCutoff(range: FinRange): Date {
  const d = startOfToday()
  if (range === 'week') d.setDate(d.getDate() - 6)
  if (range === 'month') d.setDate(1)
  return d
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OrderItemLite {
  dish_id: string | null
  quantity: number
  price: number
}

export interface TodayOrder {
  id: string
  token_number: number | null
  status: string | null
  total: number | null
  table_id: string | null
  created_at: string | null
  delivered_at: string | null
  payment_status: string | null
  payment_method: string | null
  paid_at: string | null
  paid_by: string | null
  taken_by: string | null
  order_items: OrderItemLite[]
}

export interface FinOrder {
  id: string
  total: number | null
  payment_status: string | null
  payment_method: string | null
  created_at: string | null
}

export interface StaffLite {
  id: string
  name: string
  role: string
  is_active: boolean | null
  last_active_at: string | null
}

export interface DishCatalogEntry {
  name: string
  price: number
  photo_url: string | null
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

/** Comprehensive set of today's orders (with line items). Live — 30s refresh. */
export function useTodayOrders(restaurantId: string | undefined) {
  return useQuery<TodayOrder[]>({
    queryKey: ['overview', 'today-orders', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return []
      const { data, error } = await supabase
        .from('orders')
        .select(
          'id, token_number, status, total, table_id, created_at, delivered_at, payment_status, payment_method, paid_at, paid_by, taken_by, order_items(dish_id, quantity, price)',
        )
        .eq('restaurant_id', restaurantId)
        .gte('created_at', startOfToday().toISOString())
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as unknown as TodayOrder[]
    },
    enabled: !!restaurantId,
    staleTime: 15_000,
    refetchInterval: 30_000,
  })
}

/** Orders within the selected financial range (payment fields only). 60s. */
export function useRangeFinancials(restaurantId: string | undefined, range: FinRange) {
  return useQuery<FinOrder[]>({
    queryKey: ['overview', 'financials', restaurantId, range],
    queryFn: async () => {
      if (!restaurantId) return []
      const { data, error } = await supabase
        .from('orders')
        .select('id, total, payment_status, payment_method, created_at')
        .eq('restaurant_id', restaurantId)
        .gte('created_at', finCutoff(range).toISOString())
      if (error) throw error
      return (data ?? []) as unknown as FinOrder[]
    },
    enabled: !!restaurantId,
    staleTime: 60_000,
  })
}

export interface PendingPayment {
  id: string
  token_number: number | null
  table_id: string | null
  total: number | null
  created_at: string | null
}

/** Delivered-but-unpaid orders (pending payments). Live — 30s. */
export function usePendingPayments(restaurantId: string | undefined) {
  return useQuery<PendingPayment[]>({
    queryKey: ['overview', 'pending-payments', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return []
      const { data, error } = await supabase
        .from('orders')
        .select('id, token_number, table_id, total, created_at, payment_status')
        .eq('restaurant_id', restaurantId)
        .eq('status', 'delivered')
        .neq('payment_status', 'paid')
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []).map((o) => ({
        id: o.id,
        token_number: o.token_number,
        table_id: o.table_id,
        total: o.total,
        created_at: o.created_at,
      }))
    },
    enabled: !!restaurantId,
    staleTime: 15_000,
    refetchInterval: 30_000,
  })
}

/** Staff roster — for on-duty count + performance table. Live — 30s. */
export function useStaffRoster(restaurantId: string | undefined) {
  return useQuery<StaffLite[]>({
    queryKey: ['overview', 'staff', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return []
      const { data, error } = await supabase
        .from('staff')
        .select('id, name, role, is_active, last_active_at')
        .eq('restaurant_id', restaurantId)
      if (error) throw error
      return data ?? []
    },
    enabled: !!restaurantId,
    staleTime: 15_000,
    refetchInterval: 30_000,
  })
}

/** Dish id → { name, price, photo_url } via menu → category → dish chain. */
export function useDishCatalog(restaurantId: string | undefined) {
  return useQuery<Map<string, DishCatalogEntry>>({
    queryKey: ['overview', 'dish-catalog', restaurantId],
    queryFn: async () => {
      const map = new Map<string, DishCatalogEntry>()
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
        .select('id, name, price, photo_url')
        .in('category_id', catIds)
      for (const d of dishes ?? []) {
        map.set(d.id, { name: d.name, price: Number(d.price) || 0, photo_url: d.photo_url })
      }
      return map
    },
    enabled: !!restaurantId,
    staleTime: 5 * 60_000,
  })
}
