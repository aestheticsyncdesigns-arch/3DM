import type { Restaurant } from '../types'

interface Props {
  restaurant: Restaurant
  collapsed: boolean
}

export default function MenuHeader({ restaurant, collapsed }: Props) {
  return (
    <div className="w-full">
      {/* Expanded: full cover image */}
      {!collapsed && (
        <div className="relative h-52 w-full overflow-hidden">
          {restaurant.logo_url ? (
            <img
              src={restaurant.logo_url}
              alt={restaurant.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-gray-900 to-gray-700" />
          )}

          <div className="absolute inset-0 bg-black/50" />

          <div className="absolute bottom-4 left-4 flex items-end gap-3">
            {restaurant.logo_url && (
              <img
                src={restaurant.logo_url}
                alt=""
                className="h-14 w-14 rounded-full border-2 border-white object-cover shadow-md"
              />
            )}
            <h1 className="text-xl font-bold text-white drop-shadow">{restaurant.name}</h1>
          </div>
        </div>
      )}

      {/* Collapsed: slim bar */}
      {collapsed && (
        <div className="flex items-center gap-3 bg-white px-4 py-2 shadow-md">
          {restaurant.logo_url && (
            <img
              src={restaurant.logo_url}
              alt=""
              className="h-9 w-9 rounded-full border border-gray-200 object-cover"
            />
          )}
          <span className="font-semibold text-gray-900">{restaurant.name}</span>
        </div>
      )}
    </div>
  )
}
