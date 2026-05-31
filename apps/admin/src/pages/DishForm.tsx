import { useEffect, useRef, useState } from 'react'
import type { Database } from '@3dm/shared'
import { DISH_TYPE_CONFIG } from '@3dm/shared'
import type { DishType } from '@3dm/shared'
import { supabase } from '../supabase'

type Category = Database['public']['Tables']['categories']['Row']
type Dish     = Database['public']['Tables']['dishes']['Row']

export interface DishFormProps {
  mode:                   'add' | 'edit'
  dish?:                  Dish | null
  menuId:                 string
  restaurantId:           string
  preselectedCategoryId?: string
  onSaved:                () => void
  onCancel:               () => void
}

// ─── Colour map for intensity buttons ────────────────────────────────────────
// Must be explicit strings so Tailwind includes them in the build

const COLOR_ACTIVE: Record<string, string> = {
  gray:   'border-gray-400   bg-gray-400   text-white',
  orange: 'border-orange-500 bg-orange-500 text-white',
  red:    'border-red-600    bg-red-600    text-white',
  pink:   'border-pink-500   bg-pink-500   text-white',
  purple: 'border-purple-600 bg-purple-600 text-white',
  blue:   'border-blue-500   bg-blue-500   text-white',
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function ArrowLeftIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  )
}

function UploadIcon() {
  return (
    <svg className="h-8 w-8 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  )
}

function XCircleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9"  y2="15" />
      <line x1="9"  y1="9" x2="15" y2="15" />
    </svg>
  )
}

function Spinner() {
  return (
    <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.35)" strokeWidth="4" />
      <path fill="white" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Field({ label, required, error, children }: {
  label: string; required?: boolean; error?: string; children: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}{required && <span className="ml-0.5 text-red-500"> *</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}

function inputCls(hasError: boolean) {
  return [
    'w-full rounded-xl border px-4 py-3 text-sm outline-none transition-colors',
    hasError
      ? 'border-red-400 bg-red-50 focus:border-red-400'
      : 'border-gray-200 bg-gray-50 text-gray-900 focus:border-[#FF5722] focus:bg-white',
  ].join(' ')
}

function Toggle({ checked, onChange, label, sublabel }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; sublabel?: string
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-gray-700">{label}</p>
        {sublabel && <p className="text-xs text-gray-400">{sublabel}</p>}
      </div>
      <div className="relative flex items-center">
        <input
          type="checkbox"
          checked={checked}
          onChange={e => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <div
          className={[
            'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors outline-none',
            'peer-focus-visible:ring-2 peer-focus-visible:ring-[#FF5722] peer-focus-visible:ring-offset-2',
            checked ? 'bg-[#FF5722]' : 'bg-gray-200',
          ].join(' ')}
        >
          <span className={[
            'inline-block h-4 w-4 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-6' : 'translate-x-1',
          ].join(' ')} />
        </div>
      </div>
    </label>
  )
}

const VEG_OPTIONS: { type: 'veg' | 'non-veg' | 'egg'; label: string; dotClass: string }[] = [
  { type: 'veg',     label: 'Veg',     dotClass: 'bg-green-500'  },
  { type: 'non-veg', label: 'Non-Veg', dotClass: 'bg-red-500'    },
  { type: 'egg',     label: 'Egg',     dotClass: 'bg-yellow-400' },
]

// ─── Main form ────────────────────────────────────────────────────────────────

export default function DishForm({
  mode, dish, menuId, restaurantId, preselectedCategoryId, onSaved, onCancel,
}: DishFormProps) {
  const [categories,  setCategories]  = useState<Category[]>([])

  // Form fields
  const [name,        setName]        = useState(dish?.name        ?? '')
  const [dishType,    setDishType]    = useState<DishType>(
    (dish?.dish_type as DishType | null | undefined) ?? 'food'
  )
  const [description, setDescription] = useState(dish?.description ?? '')
  const [price,       setPrice]       = useState(dish?.price != null ? String(dish.price) : '')
  const [categoryId,  setCategoryId]  = useState(
    dish?.category_id ?? preselectedCategoryId ?? ''
  )
  const [vegType,     setVegType]     = useState<'veg' | 'non-veg' | 'egg'>(
    dish?.is_veg ? 'veg' : dish?.has_egg ? 'egg' : 'non-veg'
  )
  const [intensityLevel, setIntensityLevel] = useState(
    dish?.intensity_level ?? dish?.spice_level ?? 0
  )
  const [isFeatured,  setIsFeatured]  = useState(dish?.is_featured  ?? false)
  const [isAvailable, setIsAvailable] = useState(dish?.is_available ?? true)

  // Photo
  const [photoFile,    setPhotoFile]    = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoUrl,     setPhotoUrl]     = useState<string | null>(dish?.photo_url ?? null)
  const [isDragOver,   setIsDragOver]   = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [errors,  setErrors]  = useState<Record<string, string>>({})
  const [genErr,  setGenErr]  = useState<string | null>(null)
  const [saving,  setSaving]  = useState(false)

  // When dish_type changes, reset intensity to 0 (avoids out-of-range values)
  function handleDishTypeChange(type: DishType) {
    setDishType(type)
    setIntensityLevel(0)
  }

  useEffect(() => {
    return () => { if (photoPreview) URL.revokeObjectURL(photoPreview) }
  }, [photoPreview])

  useEffect(() => {
    supabase
      .from('categories')
      .select('*')
      .eq('menu_id', menuId)
      .order('display_order', { ascending: true })
      .then(({ data }) => {
        const cats = data ?? []
        setCategories(cats)
        if (!categoryId && cats.length > 0) setCategoryId(cats[0].id)
      })
  }, [menuId]) // eslint-disable-line react-hooks/exhaustive-deps

  function handlePhotoSelect(file: File) {
    if (!file.type.startsWith('image/')) return
    if (photoPreview) URL.revokeObjectURL(photoPreview)
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
    setErrors(p => ({ ...p, photo: '' }))
  }

  function handleRemovePhoto() {
    if (photoPreview) URL.revokeObjectURL(photoPreview)
    setPhotoFile(null)
    setPhotoPreview(null)
    setPhotoUrl(null)
  }

  async function handleSave() {
    const errs: Record<string, string> = {}
    if (!name.trim())                  errs.name     = 'Dish name is required'
    if (!price || Number(price) <= 0)  errs.price    = 'Enter a valid price greater than 0'
    if (!categoryId)                   errs.category = 'Select a category'
    if (Object.keys(errs).length) { setErrors(errs); return }

    setSaving(true)
    setGenErr(null)

    try {
      let finalPhotoUrl = photoUrl

      if (photoFile) {
        const ext  = photoFile.name.split('.').pop() ?? 'jpg'
        const path = `${restaurantId}/${Date.now()}.${ext}`
        const { error: uploadErr } = await supabase.storage
          .from('dish-photos')
          .upload(path, photoFile, { upsert: true })

        if (uploadErr) {
          setGenErr(`Photo upload failed: ${uploadErr.message}`)
          return
        }

        finalPhotoUrl = supabase.storage.from('dish-photos').getPublicUrl(path).data.publicUrl
      }

      const payload = {
        name:            name.trim(),
        description:     description.trim() || null,
        price:           Number(price),
        category_id:     categoryId,
        dish_type:       dishType,
        is_veg:          vegType === 'veg',
        has_egg:         vegType === 'egg',
        intensity_level: intensityLevel,
        is_featured:     isFeatured,
        is_available:    isAvailable,
        photo_url:       finalPhotoUrl,
      }

      if (mode === 'edit' && dish) {
        const { error } = await supabase.from('dishes').update(payload).eq('id', dish.id)
        if (error) { setGenErr(error.message); return }
      } else {
        const { error } = await supabase.from('dishes').insert(payload)
        if (error) { setGenErr(error.message); return }
      }

      onSaved()
    } finally {
      setSaving(false)
    }
  }

  const typeConfig = DISH_TYPE_CONFIG[dishType]
  const displayPhoto = photoPreview ?? photoUrl

  return (
    <div>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="mb-7 flex items-center gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 shadow-sm hover:bg-gray-50 hover:text-gray-800"
          aria-label="Go back"
        >
          <ArrowLeftIcon />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {mode === 'add' ? 'Add Dish' : 'Edit Dish'}
          </h1>
          <p className="text-xs text-gray-400">
            {mode === 'add' ? 'Fill in the details for your new dish' : `Editing: ${dish?.name}`}
          </p>
        </div>
      </div>

      {/* ── Form ───────────────────────────────────────────────────────────── */}
      <div className="max-w-2xl space-y-5">

        {genErr && (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{genErr}</div>
        )}

        {/* ── 1. Dish Name ──────────────────────────────────────────────────── */}
        <Field label="Dish Name" required error={errors.name}>
          <input
            type="text"
            value={name}
            onChange={e => { setName(e.target.value); setErrors(p => ({ ...p, name: '' })) }}
            placeholder="e.g. Butter Chicken"
            className={inputCls(!!errors.name)}
          />
        </Field>

        {/* ── 2. Dish Type ──────────────────────────────────────────────────── */}
        <Field label="Dish Type">
          <div className="grid grid-cols-2 gap-2">
            {(Object.entries(DISH_TYPE_CONFIG) as [DishType, typeof DISH_TYPE_CONFIG[DishType]][]).map(
              ([type, config]) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleDishTypeChange(type)}
                  className={[
                    'flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-sm font-medium transition-all',
                    dishType === type
                      ? 'border-[#FF5722] bg-orange-50 text-gray-900 shadow-sm'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50',
                  ].join(' ')}
                >
                  <span className="text-xl">{config.icon}</span>
                  <span>{config.label}</span>
                </button>
              )
            )}
          </div>
        </Field>

        {/* ── 3. Description ────────────────────────────────────────────────── */}
        <Field label="Description">
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
            placeholder="A brief description of the dish…"
            className={inputCls(false) + ' resize-none'}
          />
        </Field>

        {/* ── 4. Price + Category ───────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Price (₹)" required error={errors.price}>
            <input
              type="number"
              value={price}
              onChange={e => { setPrice(e.target.value); setErrors(p => ({ ...p, price: '' })) }}
              placeholder="0"
              min="0"
              step="1"
              className={inputCls(!!errors.price)}
            />
          </Field>

          <Field label="Category" required error={errors.category}>
            <select
              value={categoryId}
              onChange={e => { setCategoryId(e.target.value); setErrors(p => ({ ...p, category: '' })) }}
              aria-label="Select category"
              className={inputCls(!!errors.category) + ' cursor-pointer'}
            >
              {categories.length === 0 && <option value="">No categories</option>}
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.icon ?? ''} {c.name}</option>
              ))}
            </select>
          </Field>
        </div>

        {/* ── 5. Photo ──────────────────────────────────────────────────────── */}
        <Field label="Dish Photo" error={errors.photo}>
          {displayPhoto ? (
            <div className="relative overflow-hidden rounded-2xl">
              <img src={displayPhoto} alt="Dish preview" className="h-52 w-full object-cover" />
              <div className="absolute bottom-2 right-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white hover:bg-black/80"
                >
                  Change
                </button>
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                  aria-label="Remove photo"
                >
                  <XCircleIcon />
                </button>
              </div>
            </div>
          ) : (
            <div
              onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={e => {
                e.preventDefault()
                setIsDragOver(false)
                const file = e.dataTransfer.files[0]
                if (file) handlePhotoSelect(file)
              }}
              onClick={() => fileInputRef.current?.click()}
              className={[
                'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed py-10 transition-colors',
                isDragOver
                  ? 'border-[#FF5722] bg-orange-50'
                  : 'border-gray-200 bg-gray-50 hover:border-gray-300',
              ].join(' ')}
            >
              <UploadIcon />
              <div className="text-center">
                <p className="text-sm font-medium text-gray-600">
                  Drop image here, or <span className="text-[#FF5722]">click to upload</span>
                </p>
                <p className="mt-0.5 text-xs text-gray-400">PNG · JPG · WEBP — up to 5 MB</p>
              </div>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            aria-label="Upload dish photo"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0]
              if (file) handlePhotoSelect(file)
              e.target.value = ''
            }}
          />
        </Field>

        {/* ── 6. Intensity (dynamic — hidden for healthy) ───────────────────── */}
        {typeConfig.showIntensity && (
          <Field label={typeConfig.intensityLabel}>
            <div className="flex gap-2">
              {typeConfig.levels.map(lvl => {
                const isActive = intensityLevel === lvl.value
                const activeClass = COLOR_ACTIVE[lvl.color] ?? COLOR_ACTIVE.gray
                return (
                  <button
                    key={lvl.value}
                    type="button"
                    onClick={() => setIntensityLevel(lvl.value)}
                    className={[
                      'flex-1 rounded-xl border py-3 text-sm font-semibold transition-all',
                      isActive
                        ? activeClass
                        : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300',
                    ].join(' ')}
                  >
                    {lvl.label}
                  </button>
                )
              })}
            </div>
          </Field>
        )}

        {/* ── 7. Veg / Non-Veg / Egg ───────────────────────────────────────── */}
        <Field label="Type">
          <div className="flex gap-2">
            {VEG_OPTIONS.map(opt => (
              <button
                key={opt.type}
                type="button"
                onClick={() => setVegType(opt.type)}
                className={[
                  'flex flex-1 items-center justify-center gap-2 rounded-xl border py-3 text-sm font-medium transition-all',
                  vegType === opt.type
                    ? 'border-gray-800 bg-gray-900 text-white shadow-sm'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50',
                ].join(' ')}
              >
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${opt.dotClass}`} />
                {opt.label}
              </button>
            ))}
          </div>
        </Field>

        {/* ── 8. Available / Featured ──────────────────────────────────────── */}
        <div className="divide-y divide-gray-100 rounded-2xl border border-gray-100 bg-white px-4 py-1">
          <div className="py-4">
            <Toggle
              checked={isAvailable}
              onChange={setIsAvailable}
              label="Available"
              sublabel="Guests can add this dish to their order"
            />
          </div>
          <div className="py-4">
            <Toggle
              checked={isFeatured}
              onChange={setIsFeatured}
              label="Chef's Special"
              sublabel="Shows a featured badge on the guest menu"
            />
          </div>
        </div>

        {/* ── Save / Cancel ────────────────────────────────────────────────── */}
        <div className="flex gap-3 border-t border-gray-100 pt-6 pb-10">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-gray-200 py-3.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex flex-[2] items-center justify-center gap-2 rounded-xl bg-[#FF5722] py-3.5 text-sm font-bold text-white shadow-sm disabled:opacity-70 hover:opacity-90"
          >
            {saving && <Spinner />}
            {saving ? 'Saving…' : mode === 'add' ? 'Save Dish' : 'Update Dish'}
          </button>
        </div>

      </div>
    </div>
  )
}
