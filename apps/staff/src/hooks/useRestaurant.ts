import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Restaurant } from '../types'

export function useRestaurant(subdomain: string) {
  return useQuery({
    queryKey: ['restaurant', subdomain],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('restaurants')
        .select('id, name, subdomain, logo_url, address, phone')
        .eq('subdomain', subdomain)
        .maybeSingle()

      if (error) throw error
      if (!data) throw new Error('Restaurant not found')
      return data as Restaurant
    },
    enabled: !!subdomain,
  })
}
