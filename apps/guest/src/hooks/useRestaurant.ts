import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Restaurant } from '../types'

export function useRestaurant(subdomain: string) {
  return useQuery({
    queryKey: ['restaurant', subdomain],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .eq('subdomain', subdomain)
        .single()

      if (error) throw error
      return data as Restaurant
    },
    enabled: !!subdomain,
  })
}
