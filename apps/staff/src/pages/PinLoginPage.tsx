import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useStaffAuth } from '../context/StaffAuthContext'
import { useActiveStaff } from '../hooks/useActiveStaff'
import type { StaffMember } from '../types'

interface Props {
  restaurantId: string
  restaurantName: string
}

const PIN_LENGTH = 4

// ─── Avatar helpers ───────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  'bg-[#FF5722]', 'bg-green-500', 'bg-blue-500', 'bg-purple-500',
  'bg-amber-500', 'bg-pink-500', 'bg-teal-500',
]
function avatarColor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

const ROLE_LABEL: Record<string, string> = {
  waiter: 'Waiter', chef: 'Chef', manager: 'Manager',
}

// ─── Staff selection screen ─────────────────────────────────────────────────

function StaffSelect({
  restaurantName,
  staff,
  isLoading,
  onPick,
}: {
  restaurantName: string
  staff: StaffMember[]
  isLoading: boolean
  onPick: (m: StaffMember) => void
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-900 px-6 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-[#FF5722]">{restaurantName}</p>
          <h1 className="mt-1 text-3xl font-black text-white">Who's working today?</h1>
          <p className="mt-2 text-sm text-gray-400">Tap your name to sign in</p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-32 animate-pulse rounded-2xl bg-gray-800" />
            ))}
          </div>
        ) : staff.length === 0 ? (
          <div className="rounded-2xl bg-gray-800 px-6 py-10 text-center">
            <p className="text-2xl">👥</p>
            <p className="mt-2 font-medium text-gray-300">No staff set up yet.</p>
            <p className="mt-1 text-sm text-gray-500">Ask your manager to add staff in the admin app.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {staff.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => onPick(m)}
                className="flex flex-col items-center gap-3 rounded-2xl bg-gray-800 p-5 text-center transition-colors hover:bg-gray-700 active:scale-[0.98]"
              >
                <span className={`flex h-16 w-16 items-center justify-center rounded-full text-xl font-black text-white ${avatarColor(m.id)}`}>
                  {initials(m.name)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-base font-bold text-white">{m.name}</span>
                  <span className="block text-xs capitalize text-gray-400">{ROLE_LABEL[m.role] ?? m.role}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── PIN entry screen ─────────────────────────────────────────────────────────

function PinEntry({
  person,
  restaurantId,
  onBack,
  onSuccess,
}: {
  person: StaffMember
  restaurantId: string
  onBack: () => void
  onSuccess: (m: StaffMember) => void
}) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const [shake, setShake] = useState(false)
  const [checking, setChecking] = useState(false)

  const fail = useCallback(() => {
    setError(true)
    setShake(true)
    setPin('')
    // Bounce back to the staff selection screen after the shake.
    setTimeout(() => { setShake(false); onBack() }, 600)
  }, [onBack])

  const submit = useCallback(
    async (entered: string) => {
      setChecking(true)
      setError(false)
      try {
        // @ts-expect-error — staff_login RPC exists at runtime; types not generated
        const { data, error: rpcError } = await supabase.rpc('staff_login', {
          p_restaurant_id: restaurantId,
          p_pin: entered,
        })
        const member = (rpcError ? null : data) as StaffMember | null
        // The PIN must belong to the selected person.
        if (member && member.id === person.id) {
          onSuccess(member)
          return
        }
        fail()
      } finally {
        setChecking(false)
      }
    },
    [person, restaurantId, onSuccess, fail],
  )

  const pressDigit = useCallback(
    (d: string) => {
      setError(false)
      setPin((prev) => {
        if (prev.length >= PIN_LENGTH) return prev
        const next = prev + d
        if (next.length === PIN_LENGTH) void submit(next)
        return next
      })
    },
    [submit],
  )

  const backspace = useCallback(() => {
    setError(false)
    setPin((prev) => prev.slice(0, -1))
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (checking) return
      if (e.key >= '0' && e.key <= '9') pressDigit(e.key)
      else if (e.key === 'Backspace') backspace()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pressDigit, backspace, checking])

  const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-900 px-6">
      <div className="w-full max-w-xs">
        {/* Header with the selected person */}
        <div className="mb-8 text-center">
          <span className={`mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full text-xl font-black text-white ${avatarColor(person.id)}`}>
            {initials(person.name)}
          </span>
          <h1 className="text-2xl font-black text-white">Welcome, {person.name}</h1>
          <p className="mt-2 text-sm text-gray-400">Enter your 4-digit PIN</p>
        </div>

        {/* Progress dots */}
        <div className={['mb-3 flex justify-center gap-4', shake ? 'animate-shake' : ''].join(' ')}>
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <span
              key={i}
              className={[
                'h-4 w-4 rounded-full border-2 transition-colors duration-150',
                i < pin.length ? 'border-[#FF5722] bg-[#FF5722]' : error ? 'border-red-500' : 'border-gray-600',
              ].join(' ')}
            />
          ))}
        </div>

        <p className={['mb-6 text-center text-sm font-medium transition-opacity', error ? 'text-red-500 opacity-100' : 'opacity-0'].join(' ')}>
          Incorrect PIN
        </p>

        {/* PIN pad */}
        <div className="grid grid-cols-3 gap-3">
          {KEYS.map((k) => (
            <button
              key={k}
              type="button"
              disabled={checking}
              onClick={() => pressDigit(k)}
              className="flex h-16 items-center justify-center rounded-2xl bg-gray-800 text-2xl font-bold text-white transition-colors hover:bg-gray-700 active:bg-gray-600 disabled:opacity-50"
            >
              {k}
            </button>
          ))}

          {/* Back to staff selection */}
          <button
            type="button"
            disabled={checking}
            onClick={onBack}
            className="flex h-16 items-center justify-center rounded-2xl bg-gray-800 text-xs font-semibold text-gray-300 transition-colors hover:bg-gray-700 active:bg-gray-600 disabled:opacity-50"
          >
            Back
          </button>

          <button
            type="button"
            disabled={checking}
            onClick={() => pressDigit('0')}
            className="flex h-16 items-center justify-center rounded-2xl bg-gray-800 text-2xl font-bold text-white transition-colors hover:bg-gray-700 active:bg-gray-600 disabled:opacity-50"
          >
            0
          </button>

          {/* Backspace */}
          <button
            type="button"
            disabled={checking}
            onClick={backspace}
            aria-label="Backspace"
            className="flex h-16 items-center justify-center rounded-2xl bg-gray-800 text-white transition-colors hover:bg-gray-700 active:bg-gray-600 disabled:opacity-50"
          >
            {checking ? (
              <svg className="h-6 w-6 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="4" />
                <path fill="white" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
                <line x1="18" y1="9" x2="12" y2="15" />
                <line x1="12" y1="9" x2="18" y2="15" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Two-step login flow ──────────────────────────────────────────────────────

export default function PinLoginPage({ restaurantId, restaurantName }: Props) {
  const { login } = useStaffAuth()
  const { data: staff = [], isLoading } = useActiveStaff(restaurantId)
  const [selected, setSelected] = useState<StaffMember | null>(null)

  if (!selected) {
    return (
      <StaffSelect
        restaurantName={restaurantName}
        staff={staff}
        isLoading={isLoading}
        onPick={setSelected}
      />
    )
  }

  return (
    <PinEntry
      person={selected}
      restaurantId={restaurantId}
      onBack={() => setSelected(null)}
      onSuccess={(m) => login(m)}
    />
  )
}
