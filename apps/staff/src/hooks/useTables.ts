import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { RestaurantTable } from '../types'

export function useTables(restaurantId: string | undefined) {
  return useQuery<RestaurantTable[]>({
    queryKey: ['staff-tables', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return []
      const { data, error } = await supabase
        .from('tables')
        .select('id, restaurant_id, number, is_active')
        .eq('restaurant_id', restaurantId)
        .order('number')

      if (error) throw error
      return (data ?? []) as unknown as RestaurantTable[]
    },
    enabled: !!restaurantId,
  })
}
