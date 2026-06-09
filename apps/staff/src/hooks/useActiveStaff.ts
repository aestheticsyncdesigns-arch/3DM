import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { StaffMember } from '../types'

/**
 * Active staff roster for the "Who's working today?" picker. Uses the
 * list_active_staff RPC (security definer) so the anon staff app can read names
 * + roles without ever exposing PINs.
 */
export function useActiveStaff(restaurantId: string | undefined) {
  return useQuery<StaffMember[]>({
    queryKey: ['active-staff', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return []
      // @ts-expect-error — list_active_staff RPC exists at runtime; types not generated
      const { data, error } = await supabase.rpc('list_active_staff', {
        p_restaurant_id: restaurantId,
      })
      if (error) throw error
      return (data ?? []) as StaffMember[]
    },
    enabled: !!restaurantId,
  })
}
