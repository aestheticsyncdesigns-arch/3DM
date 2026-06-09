import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Category, Dish } from '../types'

export interface CategoryWithDishes extends Category {
  dishes: Dish[]
}

export function useStaffMenu(restaurantId: string | undefined) {
  const queryClient = useQueryClient()
  const queryKey = ['staff-menu', restaurantId]

  const query = useQuery<CategoryWithDishes[]>({
    queryKey,
    queryFn: async () => {
      if (!restaurantId) throw new Error('No restaurant ID')

      // A restaurant may have more than one active menu row. Fetch all of them
      // and pull categories/dishes across the lot (resilient to duplicates).
      const { data: menuData, error: menuError } = await supabase
        .from('menus')
        .select('id')
        .eq('restaurant_id', restaurantId)
        .eq('is_active', true)
        .order('created_at', { ascending: true })

      if (menuError) return []
      const menuIds = (menuData ?? []).map((m) => m.id)
      if (menuIds.length === 0) return []

      const { data: catData, error: catError } = await supabase
        .from('categories')
        .select('*')
        .in('menu_id', menuIds)
        .order('display_order')

      if (catError) throw catError
      const categories = (catData ?? []) as unknown as Category[]
      if (categories.length === 0) return []

      const categoryIds = categories.map((c) => c.id)

      const { data: dishData, error: dishError } = await supabase
        .from('dishes')
        .select('*')
        .in('category_id', categoryIds)
        .order('display_order')

      if (dishError) throw dishError
      const dishes = (dishData ?? []) as unknown as Dish[]

      return categories.map((category) => ({
        ...category,
        dishes: dishes.filter((d) => d.category_id === category.id),
      }))
    },
    enabled: !!restaurantId,
  })

  // Live-refresh when any dish changes (e.g. chef marks one out of stock), so the
  // waiter's menu reflects availability without a manual reload.
  useEffect(() => {
    if (!restaurantId) return
    const channel = supabase
      .channel(`staff-menu-dishes-${restaurantId}`)
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
