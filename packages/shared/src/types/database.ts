export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      restaurants: {
        Row: {
          id: string
          name: string
          subdomain: string
          gstin: string | null
          logo: string | null
          address: string | null
          plan: string
          settings: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          subdomain: string
          gstin?: string | null
          logo?: string | null
          address?: string | null
          plan?: string
          settings?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          subdomain?: string
          gstin?: string | null
          logo?: string | null
          address?: string | null
          plan?: string
          settings?: Json
          updated_at?: string
        }
      }
      menus: {
        Row: {
          id: string
          restaurant_id: string
          name: string
          type: string
          schedule: Json | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          restaurant_id: string
          name: string
          type?: string
          schedule?: Json | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          restaurant_id?: string
          name?: string
          type?: string
          schedule?: Json | null
          is_active?: boolean
          updated_at?: string
        }
      }
      categories: {
        Row: {
          id: string
          menu_id: string
          name: string
          display_order: number
          created_at: string
        }
        Insert: {
          id?: string
          menu_id: string
          name: string
          display_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          menu_id?: string
          name?: string
          display_order?: number
        }
      }
      dishes: {
        Row: {
          id: string
          category_id: string
          name: string
          description: string | null
          price: number
          is_veg: boolean
          spice_level: 'mild' | 'medium' | 'spicy' | 'extra_hot' | null
          is_available: boolean
          model_3d_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          category_id: string
          name: string
          description?: string | null
          price: number
          is_veg?: boolean
          spice_level?: 'mild' | 'medium' | 'spicy' | 'extra_hot' | null
          is_available?: boolean
          model_3d_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          category_id?: string
          name?: string
          description?: string | null
          price?: number
          is_veg?: boolean
          spice_level?: 'mild' | 'medium' | 'spicy' | 'extra_hot' | null
          is_available?: boolean
          model_3d_url?: string | null
          updated_at?: string
        }
      }
      tables: {
        Row: {
          id: string
          restaurant_id: string
          number: string
          qr_code_url: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          restaurant_id: string
          number: string
          qr_code_url?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          restaurant_id?: string
          number?: string
          qr_code_url?: string | null
          is_active?: boolean
        }
      }
      orders: {
        Row: {
          id: string
          restaurant_id: string
          table_id: string | null
          status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled'
          total: number
          gst_amount: number
          payment_method: 'upi' | 'card' | 'wallet' | 'cash' | null
          payment_status: 'unpaid' | 'paid' | 'refunded'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          restaurant_id: string
          table_id?: string | null
          status?: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled'
          total?: number
          gst_amount?: number
          payment_method?: 'upi' | 'card' | 'wallet' | 'cash' | null
          payment_status?: 'unpaid' | 'paid' | 'refunded'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          restaurant_id?: string
          table_id?: string | null
          status?: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled'
          total?: number
          gst_amount?: number
          payment_method?: 'upi' | 'card' | 'wallet' | 'cash' | null
          payment_status?: 'unpaid' | 'paid' | 'refunded'
          updated_at?: string
        }
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          dish_id: string
          quantity: number
          price: number
          customizations: Json
          created_at: string
        }
        Insert: {
          id?: string
          order_id: string
          dish_id: string
          quantity?: number
          price: number
          customizations?: Json
          created_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          dish_id?: string
          quantity?: number
          price?: number
          customizations?: Json
        }
      }
      staff: {
        Row: {
          id: string
          restaurant_id: string
          name: string
          role: 'admin' | 'manager' | 'waiter' | 'chef'
          phone: string | null
          pin: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          restaurant_id: string
          name: string
          role: 'admin' | 'manager' | 'waiter' | 'chef'
          phone?: string | null
          pin: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          restaurant_id?: string
          name?: string
          role?: 'admin' | 'manager' | 'waiter' | 'chef'
          phone?: string | null
          pin?: string
          updated_at?: string
        }
      }
      inventory: {
        Row: {
          id: string
          restaurant_id: string
          item_name: string
          quantity: number
          unit: string
          reorder_level: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          restaurant_id: string
          item_name: string
          quantity?: number
          unit: string
          reorder_level?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          restaurant_id?: string
          item_name?: string
          quantity?: number
          unit?: string
          reorder_level?: number
          updated_at?: string
        }
      }
      analytics_events: {
        Row: {
          id: string
          restaurant_id: string
          event_type: string
          dish_id: string | null
          table_id: string | null
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          restaurant_id: string
          event_type: string
          dish_id?: string | null
          table_id?: string | null
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          restaurant_id?: string
          event_type?: string
          dish_id?: string | null
          table_id?: string | null
          metadata?: Json
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
