import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Database } from '@3dm/shared'
import { supabase } from '../lib/supabase'
import type { Category, Dish } from '../types'

type MenuRow = Database['public']['Tables']['menus']['Row']
type CategoryRow = Database['public']['Tables']['categories']['Row']
type DishRow = Database['public']['Tables']['dishes']['Row']

export interface CategoryWithDishes extends Category {
  dishes: Dish[]
}

export function useMenu(restaurantId: string | undefined) {
  const queryClient = useQueryClient()
  const queryKey = ['menu', restaurantId]

  const query = useQuery<CategoryWithDishes[]>({
    queryKey,
    queryFn: async () => {
      if (!restaurantId) throw new Error('No restaurant ID')

      // A restaurant may have more than one active menu row (e.g. duplicates
      // created during signup/seeding). Fetch them all rather than .single(),
      // which errors on multiple rows, and pull categories across all of them.
      const { data: menuData, error: menuError } = await supabase
        .from('menus')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('is_active', true)
        .order('created_at', { ascending: true })

      if (menuError) return []
      const menus = (menuData ?? []) as unknown as MenuRow[]
      if (menus.length === 0) return []

      const menuIds = menus.map((m) => m.id)

      const { data: catData, error: catError } = await supabase
        .from('categories')
        .select('*')
        .in('menu_id', menuIds)
        .order('display_order')

      if (catError) throw catError
      const categories = (catData ?? []) as unknown as CategoryRow[]
      if (categories.length === 0) return []

      const categoryIds = categories.map((c) => c.id)

      const { data: dishData, error: dishError } = await supabase
        .from('dishes')
        .select('*')
        .in('category_id', categoryIds)
        .eq('is_available', true)
        .order('display_order')

      if (dishError) throw dishError
      const dishes = (dishData ?? []) as unknown as DishRow[]

      return categories.map((category) => ({
        ...category,
        dishes: dishes.filter((d) => d.category_id === category.id),
      })) as CategoryWithDishes[]
    },
    enabled: !!restaurantId,
  })

  // Live-refresh when a dish changes (e.g. marked out of stock) so it drops off
  // the guest menu without a reload.
  useEffect(() => {
    if (!restaurantId) return
    const channel = supabase
      .channel(`menu-dishes-${restaurantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dishes' }, () => {
        void queryClient.invalidateQueries({ queryKey })
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId])

  return query
}
