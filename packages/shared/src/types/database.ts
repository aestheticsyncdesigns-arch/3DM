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
          logo_url: string | null
          address: string | null
          phone: string | null
          plan: string | null
          ar_credits: number | null
          created_at: string | null
        }
        Insert: {
          id?: string
          name: string
          subdomain: string
          gstin?: string | null
          logo_url?: string | null
          address?: string | null
          phone?: string | null
          plan?: string | null
          ar_credits?: number | null
          created_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          subdomain?: string
          gstin?: string | null
          logo_url?: string | null
          address?: string | null
          phone?: string | null
          plan?: string | null
          ar_credits?: number | null
        }
      }
      menus: {
        Row: {
          id: string
          restaurant_id: string | null
          name: string
          type: string | null
          schedule_start: string | null
          schedule_end: string | null
          is_active: boolean | null
          created_at: string | null
        }
        Insert: {
          id?: string
          restaurant_id?: string | null
          name: string
          type?: string | null
          schedule_start?: string | null
          schedule_end?: string | null
          is_active?: boolean | null
          created_at?: string | null
        }
        Update: {
          id?: string
          restaurant_id?: string | null
          name?: string
          type?: string | null
          schedule_start?: string | null
          schedule_end?: string | null
          is_active?: boolean | null
        }
      }
      categories: {
        Row: {
          id: string
          menu_id: string | null
          name: string
          icon: string | null
          display_order: number | null
        }
        Insert: {
          id?: string
          menu_id?: string | null
          name: string
          icon?: string | null
          display_order?: number | null
        }
        Update: {
          id?: string
          menu_id?: string | null
          name?: string
          icon?: string | null
          display_order?: number | null
        }
      }
      dishes: {
        Row: {
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
          is_available: boolean | null
          photo_url: string | null
          model_3d_url: string | null
          is_featured: boolean | null
          display_order: number | null
          created_at: string | null
        }
        Insert: {
          id?: string
          category_id?: string | null
          name: string
          name_hi?: string | null
          name_ta?: string | null
          description?: string | null
          price: number
          is_veg?: boolean | null
          has_egg?: boolean | null
          spice_level?: number | null
          is_available?: boolean | null
          photo_url?: string | null
          model_3d_url?: string | null
          is_featured?: boolean | null
          display_order?: number | null
          created_at?: string | null
        }
        Update: {
          id?: string
          category_id?: string | null
          name?: string
          name_hi?: string | null
          name_ta?: string | null
          description?: string | null
          price?: number
          is_veg?: boolean | null
          has_egg?: boolean | null
          spice_level?: number | null
          is_available?: boolean | null
          photo_url?: string | null
          model_3d_url?: string | null
          is_featured?: boolean | null
          display_order?: number | null
        }
      }
      tables: {
        Row: {
          id: string
          restaurant_id: string | null
          number: string
          qr_code_url: string | null
          is_active: boolean | null
        }
        Insert: {
          id?: string
          restaurant_id?: string | null
          number: string
          qr_code_url?: string | null
          is_active?: boolean | null
        }
        Update: {
          id?: string
          restaurant_id?: string | null
          number?: string
          qr_code_url?: string | null
          is_active?: boolean | null
        }
      }
      orders: {
        Row: {
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
        Insert: {
          id?: string
          restaurant_id?: string | null
          table_id?: string | null
          status?: string | null
          subtotal?: number | null
          cgst_amount?: number | null
          sgst_amount?: number | null
          total?: number | null
          payment_method?: string | null
          payment_status?: string | null
          razorpay_order_id?: string | null
          guest_phone?: string | null
          token_number?: number | null
          created_at?: string | null
        }
        Update: {
          id?: string
          restaurant_id?: string | null
          table_id?: string | null
          status?: string | null
          subtotal?: number | null
          cgst_amount?: number | null
          sgst_amount?: number | null
          total?: number | null
          payment_method?: string | null
          payment_status?: string | null
          razorpay_order_id?: string | null
          guest_phone?: string | null
          token_number?: number | null
        }
      }
      order_items: {
        Row: {
          id: string
          order_id: string | null
          dish_id: string | null
          quantity: number
          price: number
          customisations: string | null
        }
        Insert: {
          id?: string
          order_id?: string | null
          dish_id?: string | null
          quantity: number
          price: number
          customisations?: string | null
        }
        Update: {
          id?: string
          order_id?: string | null
          dish_id?: string | null
          quantity?: number
          price?: number
          customisations?: string | null
        }
      }
      staff: {
        Row: {
          id: string
          restaurant_id: string | null
          name: string
          role: string
          phone: string | null
          pin: string
          is_active: boolean | null
          created_at: string | null
        }
        Insert: {
          id?: string
          restaurant_id?: string | null
          name: string
          role: string
          phone?: string | null
          pin: string
          is_active?: boolean | null
          created_at?: string | null
        }
        Update: {
          id?: string
          restaurant_id?: string | null
          name?: string
          role?: string
          phone?: string | null
          pin?: string
          is_active?: boolean | null
        }
      }
      loyalty_points: {
        Row: {
          id: string
          restaurant_id: string | null
          phone: string
          points: number | null
          tier: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          restaurant_id?: string | null
          phone: string
          points?: number | null
          tier?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          restaurant_id?: string | null
          phone?: string
          points?: number | null
          tier?: string | null
        }
      }
      analytics_events: {
        Row: {
          id: string
          restaurant_id: string | null
          event_type: string
          dish_id: string | null
          table_id: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          restaurant_id?: string | null
          event_type: string
          dish_id?: string | null
          table_id?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          restaurant_id?: string | null
          event_type?: string
          dish_id?: string | null
          table_id?: string | null
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
