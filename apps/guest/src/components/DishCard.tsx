import { DISH_TYPE_CONFIG } from '@3dm/shared'
import type { DishType } from '@3dm/shared'
import { useCart } from '../context/CartContext'
import { trackArView, trackDishView } from '../lib/analytics'
import type { Dish } from '../types'

interface Props {
  dish: Dish
  restaurantId: string
  tableId: string | null
}

function FssaiDot({ type }: { type: 'veg' | 'nonveg' | 'egg' }) {
  const colors = {
    veg:    { border: '#00a550', fill: '#00a550' },
    nonveg: { border: '#e40000', fill: '#e40000' },
    egg:    { border: '#f5a623', fill: '#f5a623' },
  }
  const { border, fill } = colors[type]
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="0.5" y="0.5" width="15" height="15" rx="1.5" stroke={border} strokeWidth="1.5" fill="white" />
      <circle cx="8" cy="8" r="4.5" fill={fill} />
    </svg>
  )
}

function ChilliIcon({ color }: { color: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill={color} xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C10 2 8.5 3 7.5 4.5C6 4 4 4.5 3 6c1.5-.5 3 0 3.5 1C5 9 4.5 11 5 13c.5 2 2 4 4 5.5C11 20.5 13 21 14 21c3 0 6-2 7-5.5.5-2 0-4-1-5.5C18.5 8 17 6.5 15 6c-.5-1.5-1.5-4-3-4z" />
    </svg>
  )
}

function IntensityIndicator({ dish }: { dish: Dish }) {
  const dishType = (dish.dish_type ?? 'food') as DishType
  const config   = DISH_TYPE_CONFIG[dishType] ?? DISH_TYPE_CONFIG.food
  const level    = dish.intensity_level ?? dish.spice_level ?? 0

  if (!config.showIntensity) return null

  // ── Beverage: single icon + label ────────────────────────────────────────
  if (dishType === 'beverage') {
    const lvl = config.levels.find(l => l.value === level)
    if (!lvl) return null
    return (
      <span className="flex items-center gap-1 text-xs text-gray-500">
        <span>{lvl.icon}</span>
        <span>{lvl.label}</span>
      </span>
    )
  }

  // ── Dessert: N candy emoji icons ─────────────────────────────────────────
  if (dishType === 'dessert') {
    if (level === 0) return null
    return (
      <span className="flex items-center gap-0.5 text-xs">
        {Array.from({ length: level }).map((_, i) => (
          <span key={i}>🍬</span>
        ))}
      </span>
    )
  }

  // ── Food (default): chilli icons ─────────────────────────────────────────
  if (level === 0) {
    return <span className="text-xs text-gray-400">Mild</span>
  }

  const isExtraHot  = level >= 3
  const chilliColor = isExtraHot ? '#e53935' : '#fb8c00'

  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: level }).map((_, i) => (
        <ChilliIcon key={i} color={chilliColor} />
      ))}
      {isExtraHot && (
        <span className="ml-0.5 text-xs font-medium text-red-600">Extra Hot</span>
      )}
    </span>
  )
}

export default function DishCard({ dish, restaurantId, tableId }: Props) {
  const { addToCart, updateQuantity, items } = useCart()

  const isVeg      = dish.is_veg ?? true
  const hasEgg     = dish.has_egg ?? false
  const isAvailable = dish.is_available !== false
  const dotType: 'veg' | 'nonveg' | 'egg' = hasEgg ? 'egg' : isVeg ? 'veg' : 'nonveg'

  const cartItem = items.find((i) => i.dish.id === dish.id)
  const cartQty  = cartItem?.quantity ?? 0

  return (
    <div
      onClick={() => trackDishView(restaurantId, tableId, dish.id)}
      className={[
        'relative flex items-start gap-3 rounded-xl bg-white p-3 shadow-sm',
        !isAvailable && 'opacity-50',
      ].filter(Boolean).join(' ')}
    >
      {/* Sold Out overlay */}
      {!isAvailable && (
        <span className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gray-700 px-3 py-1 text-xs font-bold text-white">
          Sold Out
        </span>
      )}

      {/* Left: content */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* FSSAI dot + Chef's Special */}
        <div className="mb-1 flex items-center justify-between gap-2">
          <FssaiDot type={dotType} />
          {dish.is_featured && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold leading-tight text-amber-700">
              ★ Chef's Special
            </span>
          )}
        </div>

        <p className="text-base font-bold leading-tight text-gray-900">{dish.name}</p>

        <div className="mt-0.5">
          <IntensityIndicator dish={dish} />
        </div>

        {dish.description && (
          <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-gray-500">
            {dish.description}
          </p>
        )}

        <p className="mt-1.5 text-base font-bold text-gray-900">₹ {dish.price}</p>

        {dish.model_3d_url && (
          <button
            type="button"
            disabled={!isAvailable}
            onClick={(e) => {
              e.stopPropagation()
              trackArView(restaurantId, tableId, dish.id)
            }}
            className="mt-1.5 flex w-fit items-center gap-1 rounded-full border border-[#FF5722] px-2.5 py-0.5 text-[11px] font-semibold text-[#FF5722] transition-colors hover:bg-orange-50"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
            View in AR
          </button>
        )}
      </div>

      {/* Right: photo + cart control */}
      <div className="relative shrink-0">
        {dish.photo_url ? (
          <img
            src={dish.photo_url}
            alt={dish.name}
            className="h-[100px] w-[100px] rounded-xl object-cover"
          />
        ) : (
          <div className="flex h-[100px] w-[100px] items-center justify-center rounded-xl bg-gray-100">
            <span className="text-2xl">🍽️</span>
          </div>
        )}

        {/* Quantity stepper (in cart) or Add button */}
        {cartQty > 0 ? (
          <div className="absolute -bottom-3 left-1/2 flex -translate-x-1/2 items-center rounded-full bg-[#FF5722] shadow-md">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); updateQuantity(dish.id, cartQty - 1) }}
              aria-label="Decrease quantity"
              className="flex h-7 w-7 items-center justify-center text-lg font-bold text-white"
            >
              −
            </button>
            <span className="min-w-[1.25rem] text-center text-sm font-bold text-white">
              {cartQty}
            </span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); updateQuantity(dish.id, cartQty + 1) }}
              aria-label="Increase quantity"
              className="flex h-7 w-7 items-center justify-center text-lg font-bold text-white"
            >
              +
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); if (isAvailable) addToCart(dish) }}
            disabled={!isAvailable}
            aria-label={`Add ${dish.name} to cart`}
            className={[
              'absolute -bottom-2.5 -right-2.5 flex h-8 w-8 items-center justify-center rounded-full text-xl font-bold text-white shadow-md transition-colors',
              isAvailable
                ? 'bg-[#FF5722] hover:bg-orange-600 active:scale-95'
                : 'cursor-not-allowed bg-gray-400',
            ].join(' ')}
          >
            +
          </button>
        )}
      </div>
    </div>
  )
}
