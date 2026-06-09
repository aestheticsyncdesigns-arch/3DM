import { BrowserRouter, Route, Routes, useParams } from 'react-router-dom'
import { StaffAuthProvider, useStaffAuth } from './context/StaffAuthContext'
import { useRestaurant } from './hooks/useRestaurant'
import PinLoginPage from './pages/PinLoginPage'
import WaiterConsole from './pages/WaiterConsole'
import KitchenDisplay from './pages/KitchenDisplay'
import type { Restaurant } from './types'

function FullScreenMessage({ emoji, title, sub }: { emoji: string; title: string; sub?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-gray-900 px-6 text-center">
      <span className="text-5xl">{emoji}</span>
      <p className="text-lg font-semibold text-white">{title}</p>
      {sub && <p className="text-sm text-gray-400">{sub}</p>}
    </div>
  )
}

/** Renders the right console once a staff member is authenticated. */
function StaffGate({ restaurant }: { restaurant: Restaurant }) {
  const { member } = useStaffAuth()

  if (!member) {
    return <PinLoginPage restaurantId={restaurant.id} restaurantName={restaurant.name} />
  }

  if (member.role === 'chef') {
    return <KitchenDisplay restaurant={restaurant} />
  }

  // waiter, manager, or any other role → waiter console
  return <WaiterConsole restaurant={restaurant} />
}

/** Resolves the restaurant from the :subdomain param, then mounts the gate. */
function StaffApp() {
  const { subdomain } = useParams<{ subdomain: string }>()
  const { data: restaurant, isLoading, error } = useRestaurant(subdomain ?? '')

  if (isLoading) {
    return <FullScreenMessage emoji="⏳" title="Loading…" />
  }

  if (error || !restaurant) {
    return (
      <FullScreenMessage
        emoji="🔍"
        title="Restaurant not found."
        sub="Check the staff link and try again."
      />
    )
  }

  return (
    <StaffAuthProvider>
      <StaffGate restaurant={restaurant} />
    </StaffAuthProvider>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/:subdomain/staff" element={<StaffApp />} />
        <Route
          path="*"
          element={
            <FullScreenMessage
              emoji="🍽️"
              title="3DM Staff Console"
              sub="Open your restaurant's staff link, e.g. /test/staff"
            />
          }
        />
      </Routes>
    </BrowserRouter>
  )
}
