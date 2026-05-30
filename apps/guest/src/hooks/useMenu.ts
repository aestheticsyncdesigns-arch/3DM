import { useQuery } from '@tanstack/react-query'
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
  return useQuery<CategoryWithDishes[]>({
    queryKey: ['menu', restaurantId],
    queryFn: async () => {
      if (!restaurantId) throw new Error('No restaurant ID')

      const { data: menuData, error: menuError } = await supabase
        .from('menus')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('is_active', true)
        .single()

      if (menuError) return []
      const menu = menuData as unknown as MenuRow
      if (!menu) return []

      const { data: catData, error: catError } = await supabase
        .from('categories')
        .select('*')
        .eq('menu_id', menu.id)
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
}
