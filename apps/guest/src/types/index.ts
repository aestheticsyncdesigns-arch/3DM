export interface Restaurant {
  id: string
  name: string
  subdomain: string
  gstin: string | null
  logo_url: string | null
  address: string | null
  phone: string | null
  plan: string | null
  ar_credits: number | null
  created_at: string | null
}

export interface Menu {
  id: string
  restaurant_id: string | null
  name: string
  type: string | null
  schedule_start: string | null
  schedule_end: string | null
  is_active: boolean | null
  created_at: string | null
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
  name_hi: string | null
  name_ta: string | null
  description: string | null
  price: number
  is_veg: boolean | null
  has_egg: boolean | null
  spice_level: number | null
  intensity_level: number | null
  dish_type: string | null
  is_available: boolean | null
  photo_url: string | null
  model_3d_url: string | null
  is_featured: boolean | null
  display_order: number | null
  created_at: string | null
}

export interface Order {
  id: string
  restaurant_id: string | null
  table_id: string | null
  status: string | null
  subtotal: number | null
  cgst_amount: number | null
  sgst_amount: number | null
  total: number | null
  payment_method: string | null
  payment_status: string | null
  razorpay_order_id: string | null
  guest_phone: string | null
  token_number: number | null
  created_at: string | null
}

export interface OrderItem {
  id: string
  order_id: string | null
  dish_id: string | null
  quantity: number
  price: number
  customisations: string | null
}
