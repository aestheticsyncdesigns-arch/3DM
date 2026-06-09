import { useState } from 'react'
import { useRestaurant } from '../hooks/useRestaurant'
import {
  useStaff,
  useCreateStaff,
  useUpdateStaff,
  useDeleteStaff,
  type StaffRow,
  type StaffRole,
  type StaffInput,
} from '../hooks/useStaff'

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLES: { value: StaffRole; label: string }[] = [
  { value: 'waiter', label: 'Waiter' },
  { value: 'chef', label: 'Chef' },
  { value: 'manager', label: 'Manager' },
]

const ROLE_BADGE: Record<string, string> = {
  waiter: 'bg-blue-100 text-blue-700',
  chef: 'bg-amber-100 text-amber-700',
  manager: 'bg-purple-100 text-purple-700',
}

const ROLE_LABEL: Record<string, string> = {
  waiter: 'Waiter',
  chef: 'Chef',
  manager: 'Manager',
}

// Stable colour per staff member for the avatar circle. Listed as full Tailwind
// classes (not inline styles) so the JIT scanner picks them up.
const AVATAR_COLORS = [
  'bg-[#FF5722]', 'bg-green-500', 'bg-blue-500', 'bg-purple-500',
  'bg-amber-500', 'bg-pink-500', 'bg-teal-500',
]
function avatarColor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}
function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  )
}

// ─── Add / Edit modal ───────────────────────────────────────────────────────

interface ModalProps {
  initial?: StaffRow
  saving: boolean
  error: string | null
  onClose: () => void
  onSave: (input: StaffInput) => void
}

function StaffModal({ initial, saving, error, onClose, onSave }: ModalProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [role, setRole] = useState<StaffRole>((initial?.role as StaffRole) ?? 'waiter')
  const [pin, setPin] = useState(initial?.pin ?? '')
  const [phone, setPhone] = useState(initial?.phone ?? '')
  const [showPin, setShowPin] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const isEdit = !!initial

  function submit() {
    if (!name.trim()) return setLocalError('Name is required.')
    if (!/^\d{4}$/.test(pin)) return setLocalError('PIN must be exactly 4 digits.')
    setLocalError(null)
    onSave({ name: name.trim(), role, pin, phone: phone.trim() || null })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <h2 className="mb-4 text-lg font-black text-gray-900">
          {isEdit ? 'Edit Staff' : 'Add Staff'}
        </h2>

        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ram"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-[#FF5722] focus:bg-white"
            />
          </div>

          {/* Role */}
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Role</label>
            <select
              aria-label="Role"
              value={role}
              onChange={(e) => setRole(e.target.value as StaffRole)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-medium text-gray-900 outline-none focus:border-[#FF5722] focus:bg-white"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          {/* PIN */}
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">4-digit PIN</label>
            <div className="relative">
              <input
                type={showPin ? 'text' : 'password'}
                value={pin}
                inputMode="numeric"
                maxLength={4}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="••••"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 pr-11 text-sm tracking-[0.4em] text-gray-900 outline-none focus:border-[#FF5722] focus:bg-white"
              />
              <button
                type="button"
                onClick={() => setShowPin((v) => !v)}
                aria-label={showPin ? 'Hide PIN' : 'Show PIN'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <EyeIcon open={showPin} />
              </button>
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
              Phone <span className="font-normal lowercase text-gray-400">(optional)</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 98765 43210"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 outline-none focus:border-[#FF5722] focus:bg-white"
            />
          </div>

          {(localError || error) && (
            <p className="text-sm font-medium text-red-500">{localError ?? error}</p>
          )}
        </div>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="flex-1 rounded-xl bg-[#FF5722] py-3 text-sm font-bold text-white hover:opacity-90 disabled:opacity-60"
          >
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Staff'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Delete confirmation ──────────────────────────────────────────────────────

function DeleteDialog({ name, deleting, onCancel, onConfirm }: {
  name: string; deleting: boolean; onCancel: () => void; onConfirm: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <p className="text-center text-base font-bold text-gray-900">Remove {name}?</p>
        <p className="mt-1 text-center text-sm text-gray-500">
          This staff member will no longer be able to log in. This can't be undone.
        </p>
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 rounded-xl bg-red-600 py-3 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-60"
          >
            {deleting ? 'Removing…' : 'Remove'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Staff card ───────────────────────────────────────────────────────────────

function StaffCard({ s, onEdit, onDelete, onToggle, toggling }: {
  s: StaffRow
  onEdit: () => void
  onDelete: () => void
  onToggle: () => void
  toggling: boolean
}) {
  const active = s.is_active !== false
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-black text-white ${avatarColor(s.id)}`}>
          {initials(s.name)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold text-gray-900">{s.name}</p>
          <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-bold ${ROLE_BADGE[s.role] ?? 'bg-gray-100 text-gray-600'}`}>
            {ROLE_LABEL[s.role] ?? s.role}
          </span>
        </div>
      </div>

      <div className="mt-3 space-y-1.5 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-400">PIN</span>
          <span className="font-mono font-bold tracking-widest text-gray-700">••••</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Phone</span>
          <span className="font-medium text-gray-700">{s.phone || '—'}</span>
        </div>
      </div>

      {/* Active toggle */}
      <button
        type="button"
        onClick={onToggle}
        disabled={toggling}
        className="mt-3 flex w-full items-center justify-between rounded-xl bg-gray-50 px-3 py-2 disabled:opacity-50"
      >
        <span className={`text-sm font-semibold ${active ? 'text-green-600' : 'text-gray-400'}`}>
          {active ? 'Active' : 'Inactive'}
        </span>
        <span className={`relative h-6 w-11 rounded-full transition-colors ${active ? 'bg-green-500' : 'bg-gray-300'}`}>
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${active ? 'left-[1.375rem]' : 'left-0.5'}`} />
        </span>
      </button>

      {/* Actions */}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onEdit}
          className="flex-1 rounded-lg border border-gray-200 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="flex-1 rounded-lg border border-red-200 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
        >
          Delete
        </button>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StaffPage() {
  const { restaurant } = useRestaurant()
  const restaurantId = restaurant?.id
  const { data: staff = [], isLoading } = useStaff(restaurantId)

  const createStaff = useCreateStaff(restaurantId)
  const updateStaff = useUpdateStaff(restaurantId)
  const deleteStaff = useDeleteStaff(restaurantId)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<StaffRow | null>(null)
  const [deleting, setDeleting] = useState<StaffRow | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [modalError, setModalError] = useState<string | null>(null)

  function openAdd() {
    setEditing(null)
    setModalError(null)
    setModalOpen(true)
  }
  function openEdit(s: StaffRow) {
    setEditing(s)
    setModalError(null)
    setModalOpen(true)
  }

  async function handleSave(input: StaffInput) {
    setModalError(null)
    try {
      if (editing) {
        await updateStaff.mutateAsync({ id: editing.id, patch: input })
      } else {
        await createStaff.mutateAsync(input)
      }
      setModalOpen(false)
      setEditing(null)
    } catch (e) {
      setModalError(e instanceof Error ? e.message : 'Could not save staff.')
    }
  }

  async function handleToggle(s: StaffRow) {
    setTogglingId(s.id)
    try {
      await updateStaff.mutateAsync({ id: s.id, patch: { is_active: !(s.is_active !== false) } })
    } finally {
      setTogglingId(null)
    }
  }

  async function handleDelete() {
    if (!deleting) return
    try {
      await deleteStaff.mutateAsync(deleting.id)
      setDeleting(null)
    } catch {
      /* keep dialog open on error */
    }
  }

  const saving = createStaff.isPending || updateStaff.isPending

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Staff</h1>
          <p className="mt-0.5 text-sm text-gray-500">Manage who can log in to the console</p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="rounded-xl bg-[#FF5722] px-4 py-2.5 text-sm font-bold text-white hover:opacity-90"
        >
          + Add Staff
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-56 animate-pulse rounded-2xl bg-gray-100" />
          ))}
        </div>
      ) : staff.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-gray-200 py-20 text-center">
          <span className="text-4xl">👥</span>
          <p className="font-medium text-gray-500">No staff yet.</p>
          <p className="text-sm text-gray-400">Add your first team member to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {staff.map((s) => (
            <StaffCard
              key={s.id}
              s={s}
              onEdit={() => openEdit(s)}
              onDelete={() => setDeleting(s)}
              onToggle={() => handleToggle(s)}
              toggling={togglingId === s.id}
            />
          ))}
        </div>
      )}

      {modalOpen && (
        <StaffModal
          initial={editing ?? undefined}
          saving={saving}
          error={modalError}
          onClose={() => { setModalOpen(false); setEditing(null) }}
          onSave={handleSave}
        />
      )}

      {deleting && (
        <DeleteDialog
          name={deleting.name}
          deleting={deleteStaff.isPending}
          onCancel={() => setDeleting(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  )
}
