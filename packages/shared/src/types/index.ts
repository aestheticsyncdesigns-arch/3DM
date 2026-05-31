export type DishType = 'food' | 'dessert' | 'beverage' | 'healthy'

export const DISH_TYPE_CONFIG = {
  food: {
    label: 'Food',
    icon: '🍛',
    intensityLabel: 'Spice Level',
    levels: [
      { value: 0, label: 'Mild',       icon: '🌶️', color: 'gray'   },
      { value: 1, label: 'Medium',     icon: '🌶️', color: 'orange' },
      { value: 2, label: 'Spicy',      icon: '🌶️', color: 'orange' },
      { value: 3, label: 'Extra Hot',  icon: '🌶️', color: 'red'    },
    ],
    showIntensity: true,
  },
  dessert: {
    label: 'Dessert',
    icon: '🍰',
    intensityLabel: 'Sweetness',
    levels: [
      { value: 0, label: 'Light',       icon: '🍬', color: 'gray'   },
      { value: 1, label: 'Medium',      icon: '🍬', color: 'pink'   },
      { value: 2, label: 'Sweet',       icon: '🍬', color: 'pink'   },
      { value: 3, label: 'Extra Sweet', icon: '🍬', color: 'purple' },
    ],
    showIntensity: true,
  },
  beverage: {
    label: 'Beverage',
    icon: '☕',
    intensityLabel: 'Temperature',
    levels: [
      { value: 0, label: 'Cold',    icon: '❄️', color: 'blue'   },
      { value: 1, label: 'Hot',     icon: '🔥', color: 'orange' },
      { value: 2, label: 'Both',    icon: '🌡️', color: 'gray'   },
      { value: 3, label: 'Blended', icon: '🧊', color: 'blue'   },
    ],
    showIntensity: true,
  },
  healthy: {
    label: 'Healthy / Salad',
    icon: '🥗',
    intensityLabel: '',
    levels: [] as { value: number; label: string; icon: string; color: string }[],
    showIntensity: false,
  },
} as const satisfies Record<DishType, {
  label: string
  icon: string
  intensityLabel: string
  levels: readonly { value: number; label: string; icon: string; color: string }[]
  showIntensity: boolean
}>
