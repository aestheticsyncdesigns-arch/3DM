import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'
import { useAuth } from '../hooks/useAuth'
import { useRestaurant } from '../hooks/useRestaurant'
import type { Restaurant } from '../hooks/useRestaurant'

// ─── Icons ────────────────────────────────────────────────────────────────────

function GridIcon() {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
    </svg>
  )
}

function UtensilsIcon() {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
      <path d="M7 2v20" />
      <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
    </svg>
  )
}

function BellIcon() {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

function QrCodeIcon() {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="5" height="5" /><rect x="16" y="3" width="5" height="5" /><rect x="3" y="16" width="5" height="5" />
      <path d="M21 16h-3a2 2 0 0 0-2 2v3" /><path d="M21 21v.01" />
      <path d="M12 7v3a2 2 0 0 1-2 2H7" /><path d="M3 12h.01" /><path d="M12 3h.01" />
      <path d="M12 16v.01" /><path d="M16 12h1" /><path d="M21 12v.01" /><path d="M12 21v-1" />
    </svg>
  )
}

function UsersIcon() {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function BarChartIcon() {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6"  y1="20" x2="6"  y2="14" />
    </svg>
  )
}

function LogOutIcon() {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}

function HamburgerIcon() {
  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="6"  x2="21" y2="6" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6"  x2="6"  y2="18" />
      <line x1="6"  y1="6"  x2="18" y2="18" />
    </svg>
  )
}

// ─── Nav config ───────────────────────────────────────────────────────────────

interface NavItem {
  to: string
  label: string
  Icon: React.ComponentType
  end?: boolean
  ordersKey?: true   // marks the item that gets the live badge
}

const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard',            label: 'Overview',     Icon: GridIcon,    end: true },
  { to: '/dashboard/menu',       label: 'Menu Builder', Icon: UtensilsIcon },
  { to: '/dashboard/orders',     label: 'Live Orders',  Icon: BellIcon,    ordersKey: true },
  { to: '/dashboard/tables',     label: 'Tables & QR',  Icon: QrCodeIcon },
  { to: '/dashboard/staff',      label: 'Staff',        Icon: UsersIcon },
  { to: '/dashboard/analytics',  label: 'Analytics',    Icon: BarChartIcon },
]

// ─── Sidebar content (shared between desktop and mobile drawer) ───────────────

interface SidebarProps {
  restaurant: Restaurant | null
  isLoading: boolean
  pendingCount: number
  onNavClick: () => void
  onSignOut: () => void
}

function SidebarContent({ restaurant, isLoading, pendingCount, onNavClick, onSignOut }: SidebarProps) {
  return (
    <div className="flex h-full flex-col overflow-hidden">

      {/* Restaurant header */}
      <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-4">
        {/* Avatar / logo */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#FF5722] text-sm font-black text-white shadow-sm">
          {restaurant?.logo_url ? (
            <img src={restaurant.logo_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <span>{restaurant?.name?.[0]?.toUpperCase() ?? '3'}</span>
          )}
        </div>

        {/* Name + subtitle */}
        <div className="min-w-0 flex-1">
          {isLoading ? (
            <div className="h-4 w-28 animate-pulse rounded bg-gray-200" />
          ) : (
            <p className="truncate text-sm font-semibold text-gray-900">
              {restaurant?.name ?? 'My Restaurant'}
            </p>
          )}
          <p className="text-xs text-gray-400">Restaurant Admin</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3">
        <div className="flex flex-col gap-0.5">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onNavClick}
              className={({ isActive }) =>
                [
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-[#FF5722] text-white'
                    : 'text-gray-600 hover:bg-orange-50 hover:text-[#FF5722]',
                ].join(' ')
              }
            >
              {({ isActive }) => (
                <>
                  <item.Icon />
                  <span className="flex-1">{item.label}</span>
                  {item.ordersKey && pendingCount > 0 && (
                    <span
                      className={[
                        'flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-xs font-bold',
                        isActive
                          ? 'bg-white text-[#FF5722]'
                          : 'bg-[#FF5722] text-white',
                      ].join(' ')}
                    >
                      {pendingCount > 99 ? '99+' : pendingCount}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Sign out */}
      <div className="border-t border-gray-100 p-3">
        <button
          type="button"
          onClick={onSignOut}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-red-50 hover:text-red-600"
        >
          <LogOutIcon />
          Sign Out
        </button>
      </div>
    </div>
  )
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function DashboardLayout() {
  const { signOut }             = useAuth()
  const navigate                = useNavigate()
  const { restaurant, isLoading } = useRestaurant()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)

  // Live pending order count via initial fetch + Supabase Realtime
  useEffect(() => {
    if (!restaurant?.id) return

    function fetchPending() {
      supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')
        .then(({ count }) => setPendingCount(count ?? 0))
    }

    fetchPending()

    const channel = supabase
      .channel(`orders-pending-${restaurant.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `restaurant_id=eq.${restaurant.id}`,
        },
        fetchPending,
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [restaurant?.id])

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  const sidebarProps: SidebarProps = {
    restaurant,
    isLoading,
    pendingCount,
    onNavClick: () => setSidebarOpen(false),
    onSignOut: handleSignOut,
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">

      {/* ── Desktop sidebar (lg+) ─────────────────────────────────────────── */}
      <aside className="hidden w-[260px] shrink-0 flex-col border-r border-gray-200 bg-white lg:flex">
        <SidebarContent {...sidebarProps} />
      </aside>

      {/* ── Mobile drawer ─────────────────────────────────────────────────── */}

      {/* Backdrop */}
      <div
        aria-hidden="true"
        className={[
          'fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 lg:hidden',
          sidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        ].join(' ')}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Drawer panel */}
      <aside
        className={[
          'fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col border-r border-gray-200 bg-white transition-transform duration-300 lg:hidden',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        {/* Close button inside drawer */}
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close menu"
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <XIcon />
        </button>
        <SidebarContent {...sidebarProps} />
      </aside>

      {/* ── Main area ─────────────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">

        {/* Mobile top bar */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-4 lg:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
            className="text-gray-600 hover:text-gray-900"
          >
            <HamburgerIcon />
          </button>
          <span className="truncate text-base font-semibold text-gray-900">
            {restaurant?.name ?? ''}
          </span>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
