import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export interface KitchenItem {
  dish_id: string | null
  name: string
  quantity: number
  notes: string | null
}

export interface KitchenOrder {
  id: string
  token_number: number | null
  status: string | null
  created_at: string | null
  tableNumber: string | null
  items: KitchenItem[]
}

// Statuses still relevant to the kitchen. 'ready'/'delivered' have left the line.
const ACTIVE_STATUSES = ['pending', 'preparing']

/** Collapse any same-id entries (last write wins) and sort by creation time. */
function dedupeById(orders: KitchenOrder[]): KitchenOrder[] {
  const byId = new Map<string, KitchenOrder>()
  for (const o of orders) byId.set(o.id, o)
  return Array.from(byId.values()).sort((a, b) =>
    (a.created_at ?? '').localeCompare(b.created_at ?? ''),
  )
}

interface OrderRow {
  id: string
  token_number: number | null
  status: string | null
  created_at: string | null
  table_id: string | null
  restaurant_id?: string | null
}

/**
 * Resolve a single order row into a full KitchenOrder by fetching its line
 * items, dish names, and table number. Used by the Realtime handlers so a new
 * order can be appended to the cache without a full refetch.
 */
async function resolveOrder(row: OrderRow): Promise<KitchenOrder> {
  const { data: itemData } = await supabase
    .from('order_items')
    .select('order_id, dish_id, quantity, notes')
    .eq('order_id', row.id)

  const items = itemData ?? []
  const dishIds = [...new Set(items.map((i) => i.dish_id).filter(Boolean))] as string[]

  const dishNameById = new Map<string, string>()
  if (dishIds.length > 0) {
    const { data: dishData } = await supabase
      .from('dishes')
      .select('id, name')
      .in('id', dishIds)
    for (const d of dishData ?? []) dishNameById.set(d.id, d.name)
  }

  let tableNumber: string | null = null
  if (row.table_id) {
    const { data: tableData } = await supabase
      .from('tables')
      .select('number')
      .eq('id', row.table_id)
      .maybeSingle()
    tableNumber = tableData?.number ?? null
  }

  return {
    id: row.id,
    token_number: row.token_number,
    status: row.status,
    created_at: row.created_at,
    tableNumber,
    items: items.map((i) => ({
      dish_id: i.dish_id ?? null,
      name: (i.dish_id && dishNameById.get(i.dish_id)) || 'Item',
      quantity: i.quantity,
      notes: i.notes ?? null,
    })),
  }
}

export function useActiveOrders(restaurantId: string | undefined) {
  const queryClient = useQueryClient()
  const queryKey = ['kitchen-orders', restaurantId]

  const query = useQuery<KitchenOrder[]>({
    queryKey,
    queryFn: async () => {
      if (!restaurantId) return []

      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('id, token_number, status, created_at, table_id')
        .eq('restaurant_id', restaurantId)
        .in('status', ACTIVE_STATUSES)
        .order('created_at', { ascending: true })

      if (orderError) throw orderError
      const orders = orderData ?? []
      if (orders.length === 0) return []

      const orderIds = orders.map((o) => o.id)
      const tableIds = [...new Set(orders.map((o) => o.table_id).filter(Boolean))] as string[]

      // Line items for these orders
      const { data: itemData } = await supabase
        .from('order_items')
        .select('order_id, dish_id, quantity, notes')
        .in('order_id', orderIds)

      const items = itemData ?? []
      const dishIds = [...new Set(items.map((i) => i.dish_id).filter(Boolean))] as string[]

      // Dish names
      const dishNameById = new Map<string, string>()
      if (dishIds.length > 0) {
        const { data: dishData } = await supabase
          .from('dishes')
          .select('id, name')
          .in('id', dishIds)
        for (const d of dishData ?? []) dishNameById.set(d.id, d.name)
      }

      // Table numbers
      const tableNumById = new Map<string, string>()
      if (tableIds.length > 0) {
        const { data: tableData } = await supabase
          .from('tables')
          .select('id, number')
          .in('id', tableIds)
        for (const t of tableData ?? []) tableNumById.set(t.id, t.number)
      }

      const result = orders.map((o) => ({
        id: o.id,
        token_number: o.token_number,
        status: o.status,
        created_at: o.created_at,
        tableNumber: o.table_id ? tableNumById.get(o.table_id) ?? null : null,
        items: items
          .filter((i) => i.order_id === o.id)
          .map((i) => ({
            dish_id: i.dish_id ?? null,
            name: (i.dish_id && dishNameById.get(i.dish_id)) || 'Item',
            quantity: i.quantity,
            notes: i.notes ?? null,
          })),
      }))

      // Deduplicate by id — final guard against any fetch-race.
      const deduped = dedupeById(result)
      console.log(
        '[kitchen] queryFn result →',
        deduped.map((o) => ({ id: o.id, token: o.token_number, status: o.status })),
      )
      return deduped
    },
    enabled: !!restaurantId,
  })

  // Realtime: every handler mutates the cache directly via setQueryData. We never
  // call invalidateQueries here — a refetch racing with a Realtime event is exactly
  // what produced duplicate cards, so the cache is the single source of truth.
  useEffect(() => {
    if (!restaurantId) return

    // The ONLY way the cache is mutated from Realtime. Every write is forced
    // through dedupeById, so the cache can never contain two entries with the
    // same id — whatever the event ordering. We log the resulting array on every
    // write so duplicates (if any survive) are visibly traceable to their source.
    const writeCache = (label: string, updater: (prev: KitchenOrder[]) => KitchenOrder[]) => {
      queryClient.setQueryData<KitchenOrder[]>(queryKey, (prev) => {
        const next = dedupeById(updater(prev ?? []))
        console.log(
          `[kitchen] setQueryData (${label}) →`,
          next.map((o) => ({ id: o.id, token: o.token_number, status: o.status })),
        )
        return next
      })
    }

    // Insert-or-update by id (dedupe is enforced by writeCache regardless).
    const upsert = (label: string, order: KitchenOrder) => {
      writeCache(label, (existing) =>
        existing.some((o) => o.id === order.id)
          ? existing.map((o) => (o.id === order.id ? order : o))
          : [...existing, order],
      )
    }

    const channel = supabase
      .channel(`kitchen-${restaurantId}`)

      // INSERT — a new order arrived. Resolve its details async, then upsert by id.
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
        const row = payload.new as OrderRow
        if (row.restaurant_id && row.restaurant_id !== restaurantId) return
        if (!ACTIVE_STATUSES.includes(row.status ?? '')) return
        void resolveOrder(row).then((order) => upsert('orders:INSERT', order))
      })

      // UPDATE — advance status in place. Never add a duplicate entry.
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, (payload) => {
        const row = payload.new as OrderRow
        if (row.restaurant_id && row.restaurant_id !== restaurantId) return
        // Order left the active set (ready/delivered) — drop it from the board.
        if (!ACTIVE_STATUSES.includes(row.status ?? '')) {
          writeCache('orders:UPDATE(drop)', (existing) =>
            existing.filter((o) => o.id !== row.id),
          )
          return
        }
        // Still active. If already present, update status in place; otherwise
        // resolve its details and upsert (covers an order that became active late).
        const cached = queryClient.getQueryData<KitchenOrder[]>(queryKey) ?? []
        if (cached.some((o) => o.id === row.id)) {
          writeCache('orders:UPDATE', (existing) =>
            existing.map((o) => (o.id === row.id ? { ...o, status: row.status } : o)),
          )
        } else {
          void resolveOrder(row).then((order) => upsert('orders:UPDATE(add)', order))
        }
      })

      // DELETE — filter it out immediately.
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'orders' }, (payload) => {
        const deleted = payload.old as { id: string }
        writeCache('orders:DELETE', (existing) => existing.filter((o) => o.id !== deleted.id))
      })

      // order_items changed — refresh just that order's items in place (no refetch).
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, (payload) => {
        const row = (payload.new ?? payload.old) as { order_id?: string } | null
        const orderId = row?.order_id
        if (!orderId) return
        const cached = queryClient.getQueryData<KitchenOrder[]>(queryKey) ?? []
        // Only touch orders already on the board.
        if (!cached.some((o) => o.id === orderId)) return
        void supabase
          .from('orders')
          .select('id, token_number, status, created_at, table_id')
          .eq('id', orderId)
          .maybeSingle()
          .then(({ data }) => {
            if (data) void resolveOrder(data).then((order) => upsert('order_items', order))
          })
      })

      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId])

  return query
}
