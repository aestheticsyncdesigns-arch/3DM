import { useEffect, useRef, useState } from 'react'
import type { Database } from '@3dm/shared'
import { supabase } from '../supabase'
import { useRestaurant } from '../hooks/useRestaurant'
import DishForm from './DishForm'

// ─── Types ────────────────────────────────────────────────────────────────────

type Category = Database['public']['Tables']['categories']['Row'] & { dish_count?: number }
type Dish     = Database['public']['Tables']['dishes']['Row']

type DishFormState =
  | { mode: 'add'; preselectedCategoryId?: string }
  | { mode: 'edit'; dish: Dish }

// ─── Emoji config ─────────────────────────────────────────────────────────────

const FOOD_EMOJIS = [
  '🍕','🍔','🍜','🍛','🥗','🍱','🥘','🍲','🥩','🍗',
  '🥚','🥞','🍰','🍩','🧁','🍺','🥤','🍵','☕','🍹',
]

// ─── Icons ────────────────────────────────────────────────────────────────────

function PencilIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" /><path d="M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  )
}

function GripIcon() {
  return (
    <svg className="h-5 w-5 cursor-grab active:cursor-grabbing text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="9"  cy="5"  r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="5"  r="1" fill="currentColor" stroke="none" />
      <circle cx="9"  cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="9"  cy="19" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="19" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin`} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="rgba(0,0,0,0.1)" strokeWidth="4" />
      <path fill="#FF5722" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

function ImagePlaceholderIcon() {
  return (
    <svg className="h-5 w-5 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  )
}

// ─── Category Modal ───────────────────────────────────────────────────────────

interface CategoryModalProps {
  initial?: { name: string; icon: string }
  onSave:   (name: string, icon: string) => Promise<void>
  onClose:  () => void
}

function CategoryModal({ initial, onSave, onClose }: CategoryModalProps) {
  const [name,    setName]    = useState(initial?.name ?? '')
  const [icon,    setIcon]    = useState(initial?.icon ?? '🍽️')
  const [saving,  setSaving]  = useState(false)
  const [nameErr, setNameErr] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  async function handleSave() {
    if (!name.trim()) { setNameErr('Category name is required.'); return }
    setSaving(true)
    try { await onSave(name.trim(), icon) } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">
            {initial ? 'Edit Category' : 'Add Category'}
          </h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close" title="Close">
            <XIcon />
          </button>
        </div>

        <div className="mb-4">
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Category name <span className="text-red-500">*</span>
          </label>
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={e => { setName(e.target.value); setNameErr('') }}
            placeholder="e.g. Starters, Main Course…"
            className={[
              'w-full rounded-xl border px-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none transition-colors focus:bg-white',
              nameErr
                ? 'border-red-400 bg-red-50 focus:border-red-400'
                : 'border-gray-200 bg-gray-50 focus:border-[#FF5722]',
            ].join(' ')}
          />
          {nameErr && <p className="mt-1 text-xs text-red-500">{nameErr}</p>}
        </div>

        <div className="mb-6">
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Icon</label>
          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-[#FF5722] bg-orange-50 text-2xl">
              {icon}
            </span>
            <span className="text-xs text-gray-500">Selected</span>
          </div>
          <div className="grid grid-cols-10 gap-1.5 rounded-xl border border-gray-100 bg-gray-50 p-2">
            {FOOD_EMOJIS.map(e => (
              <button
                key={e}
                type="button"
                aria-label={`Select ${e}`}
                onClick={() => setIcon(e)}
                className={[
                  'flex h-9 w-9 items-center justify-center rounded-lg text-xl transition-colors',
                  icon === e ? 'bg-[#FF5722] shadow-sm' : 'hover:bg-gray-200',
                ].join(' ')}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#FF5722] py-3 text-sm font-bold text-white disabled:opacity-70"
          >
            {saving && <Spinner className="h-4 w-4" />}
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Generic delete confirmation dialog ───────────────────────────────────────

interface ConfirmDeleteProps {
  title:     string
  body:      string
  onConfirm: () => Promise<void>
  onClose:   () => void
}

function ConfirmDelete({ title, body, onConfirm, onClose }: ConfirmDeleteProps) {
  const [deleting, setDeleting] = useState(false)

  async function handleConfirm() {
    setDeleting(true)
    try { await onConfirm() } finally { setDeleting(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="mb-2 text-base font-semibold text-gray-900">{title}</h2>
        <p className="mb-5 text-sm text-gray-500">{body}</p>
        <div className="flex gap-3">
          <button type="button" onClick={onClose}
            className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button type="button" onClick={handleConfirm} disabled={deleting}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-500 py-3 text-sm font-bold text-white disabled:opacity-70">
            {deleting && <Spinner className="h-4 w-4" />}
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Category Row ─────────────────────────────────────────────────────────────

interface CategoryRowProps {
  category:    Category
  index:       number
  isDragging:  boolean
  isDragOver:  boolean
  onDragStart: (index: number) => void
  onDragOver:  (e: React.DragEvent, index: number) => void
  onDrop:      (index: number) => void
  onDragEnd:   () => void
  onEdit:      (category: Category) => void
  onDelete:    (category: Category) => void
}

function CategoryRow({
  category, index, isDragging, isDragOver,
  onDragStart, onDragOver, onDrop, onDragEnd, onEdit, onDelete,
}: CategoryRowProps) {
  return (
    <div
      draggable
      onDragStart={() => onDragStart(index)}
      onDragOver={e => onDragOver(e, index)}
      onDrop={() => onDrop(index)}
      onDragEnd={onDragEnd}
      className={[
        'flex items-center gap-3 rounded-xl border bg-white px-4 py-3 transition-all',
        isDragging ? 'opacity-40 shadow-lg ring-2 ring-[#FF5722]' : 'border-gray-200 shadow-sm',
        isDragOver ? 'border-[#FF5722] bg-orange-50' : '',
      ].join(' ')}
    >
      <GripIcon />
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-xl">
        {category.icon ?? '🍽️'}
      </span>
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-medium text-gray-900">{category.name}</p>
        <p className="text-xs text-gray-400">
          {category.dish_count === undefined ? '…' : `${category.dish_count} dish${category.dish_count === 1 ? '' : 'es'}`}
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button type="button" onClick={() => onEdit(category)}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          aria-label="Edit category">
          <PencilIcon />
        </button>
        <button type="button" onClick={() => onDelete(category)}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500"
          aria-label="Delete category">
          <TrashIcon />
        </button>
      </div>
    </div>
  )
}

// ─── Categories Tab ───────────────────────────────────────────────────────────

function CategoriesTab({ menuId }: { menuId: string | null }) {
  const [categories,   setCategories]   = useState<Category[]>([])
  const [isLoading,    setIsLoading]    = useState(true)
  const [error,        setError]        = useState<string | null>(null)
  const [modal,        setModal]        = useState<'add' | Category | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null)
  const [dragIndex,    setDragIndex]    = useState<number | null>(null)
  const [dragOverIdx,  setDragOverIdx]  = useState<number | null>(null)

  async function fetchCategories() {
    if (!menuId) { setIsLoading(false); return }
    setIsLoading(true)
    setError(null)

    const { data: cats, error: catsErr } = await supabase
      .from('categories')
      .select('*')
      .eq('menu_id', menuId)
      .order('display_order', { ascending: true, nullsFirst: false })

    if (catsErr) { setError(catsErr.message); setIsLoading(false); return }

    const withCounts = await Promise.all(
      (cats ?? []).map(async cat => {
        const { count } = await supabase
          .from('dishes')
          .select('*', { count: 'exact', head: true })
          .eq('category_id', cat.id)
        return { ...cat, dish_count: count ?? 0 }
      })
    )
    setCategories(withCounts)
    setIsLoading(false)
  }

  useEffect(() => { void fetchCategories() }, [menuId]) // eslint-disable-line

  async function handleAdd(name: string, icon: string) {
    if (!menuId) return
    const nextOrder = categories.length > 0
      ? Math.max(...categories.map(c => c.display_order ?? 0)) + 1
      : 0
    const { error: err } = await supabase
      .from('categories')
      .insert({ menu_id: menuId, name, icon, display_order: nextOrder })
    if (err) { setError(err.message); return }
    setModal(null)
    await fetchCategories()
  }

  async function handleEdit(name: string, icon: string) {
    if (!modal || modal === 'add') return
    const { error: err } = await supabase
      .from('categories').update({ name, icon }).eq('id', modal.id)
    if (err) { setError(err.message); return }
    setModal(null)
    await fetchCategories()
  }

  async function handleDelete() {
    if (!deleteTarget) return
    const { error: err } = await supabase
      .from('categories').delete().eq('id', deleteTarget.id)
    if (err) { setError(err.message); return }
    setDeleteTarget(null)
    await fetchCategories()
  }

  function handleDragStart(index: number) { setDragIndex(index) }
  function handleDragOver(e: React.DragEvent, index: number) { e.preventDefault(); setDragOverIdx(index) }

  async function handleDrop(dropIndex: number) {
    if (dragIndex === null || dragIndex === dropIndex) {
      setDragIndex(null); setDragOverIdx(null); return
    }
    const reordered = [...categories]
    const [moved] = reordered.splice(dragIndex, 1)
    reordered.splice(dropIndex, 0, moved)
    setCategories(reordered)
    setDragIndex(null); setDragOverIdx(null)
    await Promise.all(reordered.map((cat, i) =>
      supabase.from('categories').update({ display_order: i }).eq('id', cat.id)
    ))
  }

  function handleDragEnd() { setDragIndex(null); setDragOverIdx(null) }

  if (!menuId) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white py-16">
        <p className="text-sm text-gray-400">No active menu found for this restaurant.</p>
      </div>
    )
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">
            {isLoading ? 'Loading…' : `${categories.length} categor${categories.length === 1 ? 'y' : 'ies'}`}
          </h2>
          <p className="text-xs text-gray-400">Drag to reorder — order reflects on the guest menu</p>
        </div>
        <button type="button" onClick={() => setModal('add')}
          className="flex items-center gap-2 rounded-xl bg-[#FF5722] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90">
          <PlusIcon /> Add Category
        </button>
      </div>

      {error && <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

      {isLoading && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map(i => <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-100" />)}
        </div>
      )}

      {!isLoading && categories.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white py-16">
          <span className="mb-3 text-4xl">🍽️</span>
          <p className="text-sm font-medium text-gray-500">No categories yet</p>
          <p className="mt-1 text-xs text-gray-400">Add a category to start building your menu</p>
          <button type="button" onClick={() => setModal('add')}
            className="mt-4 flex items-center gap-2 rounded-xl bg-[#FF5722] px-4 py-2.5 text-sm font-semibold text-white">
            <PlusIcon /> Add Category
          </button>
        </div>
      )}

      {!isLoading && categories.length > 0 && (
        <div className="flex flex-col gap-2">
          {categories.map((cat, i) => (
            <CategoryRow key={cat.id} category={cat} index={i}
              isDragging={dragIndex === i}
              isDragOver={dragOverIdx === i && dragIndex !== i}
              onDragStart={handleDragStart} onDragOver={handleDragOver}
              onDrop={handleDrop} onDragEnd={handleDragEnd}
              onEdit={c => setModal(c)} onDelete={c => setDeleteTarget(c)} />
          ))}
        </div>
      )}

      {modal === 'add' && <CategoryModal onSave={handleAdd} onClose={() => setModal(null)} />}
      {modal && modal !== 'add' && (
        <CategoryModal
          initial={{ name: modal.name, icon: modal.icon ?? '🍽️' }}
          onSave={handleEdit} onClose={() => setModal(null)} />
      )}
      {deleteTarget && (
        <ConfirmDelete
          title="Delete category?"
          body={`"${deleteTarget.name}" will be permanently removed along with all its dishes. This cannot be undone.`}
          onConfirm={handleDelete} onClose={() => setDeleteTarget(null)} />
      )}
    </>
  )
}

// ─── Dish Row ─────────────────────────────────────────────────────────────────

interface DishRowProps {
  dish:     Dish
  onToggle: (dish: Dish) => Promise<void>
  onEdit:   (dish: Dish) => void
  onDelete: (dish: Dish) => void
}

function DishRow({ dish, onToggle, onEdit, onDelete }: DishRowProps) {
  const [toggling, setToggling] = useState(false)

  async function handleToggle() {
    setToggling(true)
    await onToggle(dish)
    setToggling(false)
  }

  const vegDot = dish.is_veg
    ? 'bg-green-500'
    : dish.has_egg
      ? 'bg-yellow-400'
      : 'bg-red-500'

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      {/* Photo thumbnail */}
      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-gray-100">
        {dish.photo_url
          ? <img src={dish.photo_url} alt="" className="h-full w-full object-cover" />
          : <div className="flex h-full w-full items-center justify-center"><ImagePlaceholderIcon /></div>
        }
      </div>

      {/* Name + badges */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${vegDot}`} />
          <p className="truncate text-sm font-medium text-gray-900">{dish.name}</p>
          {dish.is_featured && (
            <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-700">
              ★ Special
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-gray-500">₹{dish.price}</p>
      </div>

      {/* Available toggle pill — one-tap instant update */}
      <button
        type="button"
        onClick={handleToggle}
        disabled={toggling}
        className={[
          'shrink-0 rounded-full border px-3 py-1 text-xs font-semibold transition-colors disabled:opacity-50',
          dish.is_available
            ? 'border-green-200 bg-green-100 text-green-700 hover:bg-green-200'
            : 'border-gray-200 bg-gray-100 text-gray-500 hover:bg-gray-200',
        ].join(' ')}
      >
        {dish.is_available ? 'Available' : 'Sold Out'}
      </button>

      {/* Edit / Delete */}
      <div className="flex shrink-0 items-center gap-1">
        <button type="button" onClick={() => onEdit(dish)}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          aria-label="Edit dish">
          <PencilIcon />
        </button>
        <button type="button" onClick={() => onDelete(dish)}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500"
          aria-label="Delete dish">
          <TrashIcon />
        </button>
      </div>
    </div>
  )
}

// ─── Dishes Tab ───────────────────────────────────────────────────────────────

interface DishesTabProps {
  menuId:      string | null
  refreshKey:  number
  onAddDish:   (preselectedCategoryId?: string) => void
  onEditDish:  (dish: Dish) => void
}

function DishesTab({ menuId, refreshKey, onAddDish, onEditDish }: DishesTabProps) {
  const [categories,   setCategories]   = useState<Category[]>([])
  const [dishes,       setDishes]       = useState<Dish[]>([])
  const [isLoading,    setIsLoading]    = useState(true)
  const [error,        setError]        = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Dish | null>(null)

  useEffect(() => {
    if (!menuId) { setIsLoading(false); return }

    async function load() {
      setIsLoading(true)
      setError(null)

      const { data: cats, error: catErr } = await supabase
        .from('categories')
        .select('*')
        .eq('menu_id', menuId!)
        .order('display_order', { ascending: true, nullsFirst: false })

      if (catErr) { setError(catErr.message); setIsLoading(false); return }

      setCategories(cats ?? [])
      if (!cats?.length) { setDishes([]); setIsLoading(false); return }

      const catIds = cats.map(c => c.id)
      const { data: dishList, error: dishErr } = await supabase
        .from('dishes')
        .select('*')
        .in('category_id', catIds)
        .order('display_order', { ascending: true, nullsFirst: false })

      if (dishErr) { setError(dishErr.message) }
      setDishes(dishList ?? [])
      setIsLoading(false)
    }

    void load()
  }, [menuId, refreshKey])

  async function handleToggleAvailable(dish: Dish) {
    const newVal = !(dish.is_available ?? true)
    // Optimistic update
    setDishes(prev => prev.map(d => d.id === dish.id ? { ...d, is_available: newVal } : d))
    const { error: err } = await supabase
      .from('dishes').update({ is_available: newVal }).eq('id', dish.id)
    if (err) {
      // Roll back on error
      setDishes(prev => prev.map(d => d.id === dish.id ? { ...d, is_available: !newVal } : d))
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    const { error: err } = await supabase.from('dishes').delete().eq('id', deleteTarget.id)
    if (!err) setDishes(prev => prev.filter(d => d.id !== deleteTarget.id))
    setDeleteTarget(null)
  }

  if (!menuId) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white py-16">
        <p className="text-sm text-gray-400">No active menu found.</p>
      </div>
    )
  }

  // Group dishes by category
  const groups = categories.map(cat => ({
    category: cat,
    dishes:   dishes.filter(d => d.category_id === cat.id),
  }))

  const totalDishes = dishes.length

  return (
    <>
      {/* Header row */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">
            {isLoading ? 'Loading…' : `${totalDishes} dish${totalDishes === 1 ? '' : 'es'}`}
          </h2>
          <p className="text-xs text-gray-400">Toggle availability instantly · Edit or delete any dish</p>
        </div>
        <button
          type="button"
          onClick={() => onAddDish()}
          className="flex items-center gap-2 rounded-xl bg-[#FF5722] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90"
        >
          <PlusIcon /> Add Dish
        </button>
      </div>

      {error && <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

      {isLoading && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map(i => <div key={i} className="h-20 animate-pulse rounded-xl bg-gray-100" />)}
        </div>
      )}

      {!isLoading && categories.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white py-16">
          <span className="mb-3 text-4xl">📂</span>
          <p className="text-sm font-medium text-gray-500">No categories yet</p>
          <p className="mt-1 text-xs text-gray-400">Add categories first, then add dishes to them</p>
        </div>
      )}

      {!isLoading && categories.length > 0 && (
        <div className="flex flex-col gap-4">
          {groups.map(({ category, dishes: catDishes }) => (
            <div key={category.id} className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              {/* Category header */}
              <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{category.icon ?? '🍽️'}</span>
                  <span className="text-sm font-semibold text-gray-800">{category.name}</span>
                  <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-500">
                    {catDishes.length}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onAddDish(category.id)}
                  className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#FF5722] hover:bg-orange-50"
                >
                  <PlusIcon /> Add
                </button>
              </div>

              {/* Dishes in this category */}
              {catDishes.length === 0 ? (
                <div className="px-4 py-5 text-center text-xs text-gray-400">
                  No dishes in this category yet
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {catDishes.map(dish => (
                    <DishRow
                      key={dish.id}
                      dish={dish}
                      onToggle={handleToggleAvailable}
                      onEdit={onEditDish}
                      onDelete={d => setDeleteTarget(d)}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {deleteTarget && (
        <ConfirmDelete
          title="Delete dish?"
          body={`"${deleteTarget.name}" will be permanently removed. This cannot be undone.`}
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

type Tab = 'categories' | 'dishes'

export default function MenuBuilderPage() {
  const { restaurant, isLoading: restaurantLoading } = useRestaurant()
  const [activeTab,       setActiveTab]       = useState<Tab>('categories')
  const [menuId,          setMenuId]          = useState<string | null>(null)
  const [menuLoading,     setMenuLoading]     = useState(true)
  const [dishForm,        setDishForm]        = useState<DishFormState | null>(null)
  const [dishesRefreshKey, setDishesRefreshKey] = useState(0)

  useEffect(() => {
    if (!restaurant?.id) return
    supabase
      .from('menus')
      .select('id')
      .eq('restaurant_id', restaurant.id)
      .eq('is_active', true)
      .limit(1)
      .single()
      .then(({ data }) => {
        setMenuId(data?.id ?? null)
        setMenuLoading(false)
      })
  }, [restaurant?.id])

  function handleDishSaved() {
    setDishForm(null)
    setDishesRefreshKey(k => k + 1)
    setActiveTab('dishes')
  }

  if (restaurantLoading || menuLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  // ── Full-page dish form ──────────────────────────────────────────────────────
  if (dishForm !== null) {
    return (
      <DishForm
        mode={dishForm.mode}
        dish={dishForm.mode === 'edit' ? dishForm.dish : null}
        menuId={menuId ?? ''}
        restaurantId={restaurant?.id ?? ''}
        preselectedCategoryId={
          dishForm.mode === 'add' ? dishForm.preselectedCategoryId : undefined
        }
        onSaved={handleDishSaved}
        onCancel={() => setDishForm(null)}
      />
    )
  }

  // ── Normal list view ─────────────────────────────────────────────────────────
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Menu Builder</h1>
        <p className="mt-0.5 text-sm text-gray-500">Manage your menu categories and dishes</p>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex w-fit gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
        {(['categories', 'dishes'] as Tab[]).map(key => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={[
              'rounded-lg px-5 py-2 text-sm font-semibold capitalize transition-colors',
              activeTab === key
                ? 'bg-[#FF5722] text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-800',
            ].join(' ')}
          >
            {key === 'categories' ? 'Categories' : 'Dishes'}
          </button>
        ))}
      </div>

      {activeTab === 'categories' && <CategoriesTab menuId={menuId} />}

      {activeTab === 'dishes' && (
        <DishesTab
          menuId={menuId}
          refreshKey={dishesRefreshKey}
          onAddDish={categoryId => setDishForm({ mode: 'add', preselectedCategoryId: categoryId })}
          onEditDish={dish => setDishForm({ mode: 'edit', dish })}
        />
      )}
    </div>
  )
}
