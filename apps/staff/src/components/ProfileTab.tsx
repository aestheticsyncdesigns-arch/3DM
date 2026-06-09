import { useWaiterStats } from '../hooks/useWaiterStats'
import type { StaffMember } from '../types'

function getSessionStaffId(): string | null {
  try {
    const raw = sessionStorage.getItem('3dm_staff')
    if (!raw) return null
    return (JSON.parse(raw) as { id?: string }).id ?? null
  } catch {
    return null
  }
}

interface Props {
  member: StaffMember
  restaurantId: string
  restaurantName: string
  onSwitchStaff: () => void
  onLogout: () => void
}

const ROLE_LABEL: Record<string, string> = {
  waiter: 'Waiter', chef: 'Chef', manager: 'Manager',
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 text-center shadow-sm">
      <p className="text-2xl font-black text-gray-900">{value}</p>
      <p className="mt-0.5 text-xs font-medium text-gray-400">{label}</p>
    </div>
  )
}

export default function ProfileTab({ member, restaurantId, restaurantName, onSwitchStaff, onLogout }: Props) {
  // sessionStorage is the source of truth — avoids stale prop drilling
  const staffId = getSessionStaffId() ?? member.id
  const { data: stats } = useWaiterStats(restaurantId, staffId)

  return (
    <div className="mx-auto max-w-md p-4">
      {/* Identity */}
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm">
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-[#FF5722] text-2xl font-black text-white">
          {initials(member.name)}
        </span>
        <div>
          <p className="text-xl font-black text-gray-900">{member.name}</p>
          <p className="text-sm capitalize text-gray-400">{ROLE_LABEL[member.role] ?? member.role}</p>
        </div>
        <p className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-500">
          {restaurantName}
        </p>
      </div>

      {/* Today's stats */}
      <p className="mb-2 mt-6 text-xs font-bold uppercase tracking-wide text-gray-400">Today</p>
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Orders Taken" value={stats?.ordersTaken ?? 0} />
        <StatCard label="Payments" value={stats?.paymentsCollected ?? 0} />
        <StatCard label="Collected" value={`₹${stats?.revenueCollected ?? 0}`} />
      </div>

      {/* Actions */}
      <div className="mt-6 space-y-3">
        <button
          type="button"
          onClick={onSwitchStaff}
          className="w-full rounded-xl border border-gray-200 bg-white py-3.5 text-sm font-bold text-gray-700 hover:bg-gray-50"
        >
          Switch Staff
        </button>
        <button
          type="button"
          onClick={onLogout}
          className="w-full rounded-xl bg-red-600 py-3.5 text-sm font-bold text-white hover:bg-red-700"
        >
          Log Out
        </button>
      </div>
    </div>
  )
}
