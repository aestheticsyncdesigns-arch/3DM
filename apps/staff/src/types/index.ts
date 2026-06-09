export interface Restaurant {
  id: string
  name: string
  subdomain: string
  logo_url: string | null
  address: string | null
  phone: string | null
}

export interface Category {
  id: string
  menu_id: string | null
  name: string
  icon: string | null
  display_order: number | null
}

export interface Dish {
  id: string
  category_id: string | null
  name: string
  description: string | null
  price: number
  is_veg: boolean | null
  has_egg: boolean | null
  spice_level: number | null
  intensity_level: number | null
  dish_type: string | null
  is_available: boolean | null
  photo_url: string | null
  display_order: number | null
  stock_note: string | null
}

export interface RestaurantTable {
  id: string
  restaurant_id: string | null
  number: string
  is_active: boolean | null
}

export interface OrderItem {
  id: string
  order_id: string | null
  dish_id: string | null
  quantity: number
  price: number
}

export interface Order {
  id: string
  restaurant_id: string | null
  table_id: string | null
  status: string | null
  total: number | null
  token_number: number | null
  created_at: string | null
}

export type StaffRole = 'waiter' | 'chef' | 'manager' | string

export interface StaffMember {
  id: string
  name: string
  role: StaffRole
}

/** A line in the in-progress order the waiter is assembling. */
export interface OrderLine {
  dish: Dish
  quantity: number
}
