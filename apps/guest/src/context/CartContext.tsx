import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Dish } from '../types'

export interface CartItem {
  dish: Dish
  quantity: number
}

interface CartContextValue {
  items: CartItem[]
  addToCart: (dish: Dish) => void
  removeFromCart: (dishId: string) => void
  updateQuantity: (dishId: string, quantity: number) => void
  clearCart: () => void
  itemCount: number
  subtotal: number
  gstAmount: number
  total: number
  restaurantId: string | null
  tableId: string | null
  setOrderContext: (restaurantId: string, tableId: string | null) => void
}

const CartContext = createContext<CartContextValue | null>(null)

const STORAGE_KEY = '3dm_cart'
const CONTEXT_KEY = '3dm_order_context'

function loadFromSession(): CartItem[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as CartItem[]) : []
  } catch {
    return []
  }
}

function loadContextFromSession(): { restaurantId: string | null; tableId: string | null } {
  try {
    const raw = sessionStorage.getItem(CONTEXT_KEY)
    return raw ? JSON.parse(raw) : { restaurantId: null, tableId: null }
  } catch {
    return { restaurantId: null, tableId: null }
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(loadFromSession)
  const savedCtx = loadContextFromSession()
  const [restaurantId, setRestaurantId] = useState<string | null>(savedCtx.restaurantId)
  const [tableId, setTableId] = useState<string | null>(savedCtx.tableId)

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [items])

  useEffect(() => {
    sessionStorage.setItem(CONTEXT_KEY, JSON.stringify({ restaurantId, tableId }))
  }, [restaurantId, tableId])

  function addToCart(dish: Dish) {
    setItems((prev) => {
      const existing = prev.find((i) => i.dish.id === dish.id)
      if (existing) {
        return prev.map((i) =>
          i.dish.id === dish.id ? { ...i, quantity: i.quantity + 1 } : i,
        )
      }
      return [...prev, { dish, quantity: 1 }]
    })
  }

  function removeFromCart(dishId: string) {
    setItems((prev) => prev.filter((i) => i.dish.id !== dishId))
  }

  function updateQuantity(dishId: string, quantity: number) {
    if (quantity <= 0) {
      removeFromCart(dishId)
      return
    }
    setItems((prev) =>
      prev.map((i) => (i.dish.id === dishId ? { ...i, quantity } : i)),
    )
  }

  function clearCart() {
    setItems([])
  }

  function setOrderContext(rId: string, tId: string | null) {
    setRestaurantId(rId)
    setTableId(tId)
  }

  const subtotal = items.reduce((sum, i) => sum + i.dish.price * i.quantity, 0)
  const gstAmount = Math.round(subtotal * 0.05)
  const total = subtotal + gstAmount
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0)

  return (
    <CartContext.Provider
      value={{
        items, addToCart, removeFromCart, updateQuantity, clearCart,
        itemCount, subtotal, gstAmount, total,
        restaurantId, tableId, setOrderContext,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>')
  return ctx
}
