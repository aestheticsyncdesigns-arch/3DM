import { supabase } from './supabase'

// localStorage / sessionStorage keys
const DEVICE_KEY = '3dm_device_id'
const SESSION_KEY = '3dm_session_id'

/** RFC4122 v4 UUID — uses crypto.randomUUID when available, with a safe fallback. */
function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/** Stable per-device id — generated once, reused across visits. */
export function getDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY)
    if (!id) {
      id = uuid()
      localStorage.setItem(DEVICE_KEY, id)
    }
    return id
  } catch {
    return uuid()
  }
}

/** Per-browser-session id — new each session, persists across page loads in a tab. */
export function getSessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_KEY)
    if (!id) {
      id = uuid()
      sessionStorage.setItem(SESSION_KEY, id)
    }
    return id
  } catch {
    return uuid()
  }
}

type EventType = 'menu_view' | 'dish_view' | 'ar_view'

interface TrackArgs {
  eventType: EventType
  restaurantId: string
  tableId?: string | null
  dishId?: string | null
  metadata?: Record<string, unknown>
}

/**
 * Insert an analytics event via the anon client. Fire-and-forget: failures are
 * logged but never thrown, so analytics can never block or break the UI.
 * Always attaches device_id + session_id to metadata.
 */
function track({ eventType, restaurantId, tableId, dishId, metadata }: TrackArgs): void {
  if (!restaurantId) return
  const payload = {
    event_type: eventType,
    restaurant_id: restaurantId,
    table_id: tableId ?? null,
    dish_id: dishId ?? null,
    metadata: {
      device_id: getDeviceId(),
      session_id: getSessionId(),
      ...metadata,
    },
  }
  void supabase
    .from('analytics_events')
    .insert(payload)
    .then(({ error }) => {
      if (error) console.warn(`[analytics] ${eventType} insert failed:`, error.message)
    })
}

/** Guest opened the menu page. Metadata: device_id, session_id, user_agent. */
export function trackMenuView(restaurantId: string, tableId?: string | null): void {
  track({
    eventType: 'menu_view',
    restaurantId,
    tableId,
    metadata: { user_agent: navigator.userAgent },
  })
}

/** Guest tapped a dish card to view it. Metadata: dish_id, device_id, session_id. */
export function trackDishView(restaurantId: string, tableId: string | null | undefined, dishId: string): void {
  track({ eventType: 'dish_view', restaurantId, tableId, dishId, metadata: { dish_id: dishId } })
}

/** Guest tapped "View in AR" on a dish. Metadata: dish_id, device_id, session_id. */
export function trackArView(restaurantId: string, tableId: string | null | undefined, dishId: string): void {
  track({ eventType: 'ar_view', restaurantId, tableId, dishId, metadata: { dish_id: dishId } })
}
