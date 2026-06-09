import { useRef, useState } from 'react'
import { supabase } from '../supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExtractedDish {
  category_name: string
  dish_name:     string
  description:   string | null
  price:         number
  is_veg:        boolean
}

type Stage = 'idle' | 'reading' | 'preview' | 'importing' | 'done'

interface ImportMenuModalProps {
  menuId:       string
  restaurantId: string
  onClose:      () => void
  onImported:   () => void
}

// ─── The exact prompt sent to OpenAI ──────────────────────────────────────────

const OPENAI_PROMPT =
  'Extract all menu items from this restaurant menu. Return a JSON array where ' +
  'each item has these fields: category_name (string), dish_name (string), ' +
  'description (string or null), price (number, in rupees, just the number), ' +
  'is_veg (boolean, true if vegetarian). Only return the JSON array, nothing else.'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Could not read the file'))
    reader.readAsDataURL(file)
  })
}

/** Parse the model's reply into a clean dish array, tolerating code fences / prose. */
function parseDishes(raw: string): ExtractedDish[] {
  let txt = raw.trim()

  // Strip ```json ... ``` fences if present
  const fence = txt.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) txt = fence[1].trim()

  // Narrow to the outermost array
  const start = txt.indexOf('[')
  const end   = txt.lastIndexOf(']')
  if (start !== -1 && end !== -1 && end > start) txt = txt.slice(start, end + 1)

  const data = JSON.parse(txt)
  if (!Array.isArray(data)) return []

  return data
    .map((d): ExtractedDish => ({
      category_name: String(d.category_name ?? 'Uncategorised').trim() || 'Uncategorised',
      dish_name:     String(d.dish_name ?? '').trim(),
      description:   d.description == null ? null : String(d.description).trim() || null,
      price:         Number(d.price) || 0,
      is_veg:        d.is_veg === true,
    }))
    .filter(d => d.dish_name.length > 0)
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function XIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function PdfIcon({ className = 'h-8 w-8 text-gray-300' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="9" y1="13" x2="15" y2="13" />
      <line x1="9" y1="17" x2="13" y2="17" />
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

function CheckCircleIcon() {
  return (
    <svg className="h-12 w-12 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function ImportMenuModal({
  menuId, restaurantId, onClose, onImported,
}: ImportMenuModalProps) {
  const [stage,    setStage]    = useState<Stage>('idle')
  const [file,     setFile]     = useState<File | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  const [extracted, setExtracted] = useState<ExtractedDish[]>([])
  const [checked,   setChecked]   = useState<boolean[]>([])
  const [importedCount, setImportedCount] = useState(0)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const busy = stage === 'reading' || stage === 'importing'

  function pickFile(f: File) {
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
      setError('Please select a PDF file.')
      return
    }
    setError(null)
    setFile(f)
  }

  // ── Step 1: upload to storage + send to OpenAI ──────────────────────────────
  async function handleRead() {
    if (!file) return
    setStage('reading')
    setError(null)

    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined
      console.log('[ImportMenu] VITE_GEMINI_API_KEY =', apiKey)
      if (!apiKey) {
        throw new Error(
          'Gemini API key not configured. Add VITE_GEMINI_API_KEY to apps/admin/.env.local and restart the dev server.',
        )
      }

      // Upload a copy to the temp-uploads bucket (non-fatal if it fails)
      const path = `${restaurantId}/${Date.now()}-${file.name}`
      const { error: uploadErr } = await supabase.storage
        .from('temp-uploads')
        .upload(path, file, { upsert: true, contentType: 'application/pdf' })
      if (uploadErr) {
        console.warn('temp-uploads upload failed:', uploadErr.message)
      }

      const dataUrl = await fileToDataUrl(file)
      // dataUrl is "data:application/pdf;base64,<data>" — extract just the base64 part
      const base64Data = dataUrl.split(',')[1]

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: OPENAI_PROMPT },
                  { inline_data: { mime_type: 'application/pdf', data: base64Data } },
                ],
              },
            ],
          }),
        },
      )

      if (!res.ok) {
        let detail = `${res.status} ${res.statusText}`
        try {
          const errJson = await res.json()
          if (errJson?.error?.message) detail = errJson.error.message
        } catch { /* ignore */ }
        throw new Error(`Gemini request failed: ${detail}`)
      }

      const json    = await res.json()
      const content = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
      const dishes  = parseDishes(content)

      if (dishes.length === 0) {
        throw new Error('No menu items could be read from this PDF. Try a clearer or text-based PDF.')
      }

      setExtracted(dishes)
      setChecked(dishes.map(() => true))
      setStage('preview')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong while reading the menu.')
      setStage('idle')
    }
  }

  // ── Step 2: import selected dishes (creating categories as needed) ──────────
  async function handleImport() {
    const selected = extracted.filter((_, i) => checked[i])
    if (selected.length === 0) {
      setError('Select at least one dish to import.')
      return
    }

    setStage('importing')
    setError(null)

    try {
      // Existing categories for this menu
      const { data: existing, error: catErr } = await supabase
        .from('categories')
        .select('*')
        .eq('menu_id', menuId)
      if (catErr) throw new Error(catErr.message)

      const catMap = new Map<string, string>() // lowercase name → id
      let maxOrder = 0
      for (const c of existing ?? []) {
        catMap.set(c.name.trim().toLowerCase(), c.id)
        if ((c.display_order ?? 0) > maxOrder) maxOrder = c.display_order ?? 0
      }

      // Create any missing categories
      const neededNames = Array.from(
        new Set(selected.map(d => d.category_name.trim()).filter(Boolean)),
      )
      for (const catName of neededNames) {
        if (catMap.has(catName.toLowerCase())) continue
        maxOrder += 1
        const { data: created, error: createErr } = await supabase
          .from('categories')
          .insert({ menu_id: menuId, name: catName, icon: '🍽️', display_order: maxOrder })
          .select()
          .single()
        if (createErr) throw new Error(createErr.message)
        if (created) catMap.set(catName.toLowerCase(), created.id)
      }

      // Insert dishes
      const rows = selected.map(d => ({
        name:            d.dish_name,
        description:     d.description,
        price:           d.price,
        category_id:     catMap.get(d.category_name.trim().toLowerCase()) ?? null,
        dish_type:       'food',
        is_veg:          d.is_veg,
        has_egg:         false,
        intensity_level: 0,
        is_featured:     false,
        is_available:    true,
      }))

      const { error: insertErr } = await supabase.from('dishes').insert(rows)
      if (insertErr) throw new Error(insertErr.message)

      setImportedCount(rows.length)
      setStage('done')
      onImported()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to import the selected dishes.')
      setStage('preview')
    }
  }

  const selectedCount = checked.filter(Boolean).length
  const allChecked    = extracted.length > 0 && selectedCount === extracted.length

  function toggleAll() {
    const next = !allChecked
    setChecked(extracted.map(() => next))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={busy ? undefined : onClose} />

      <div className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
              <span className="text-lg">✨</span> AI Menu Reader
            </h2>
            <p className="text-xs text-gray-400">Import dishes straight from a PDF menu</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-40"
            aria-label="Close"
            title="Close"
          >
            <XIcon />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {error && (
            <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
          )}

          {/* ── Stage: idle (upload / selected) ──────────────────────────────── */}
          {stage === 'idle' && (
            <>
              {!file ? (
                <div
                  onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={e => {
                    e.preventDefault()
                    setIsDragOver(false)
                    const f = e.dataTransfer.files[0]
                    if (f) pickFile(f)
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={[
                    'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed py-14 transition-colors',
                    isDragOver ? 'border-[#FF5722] bg-orange-50' : 'border-gray-200 bg-gray-50 hover:border-gray-300',
                  ].join(' ')}
                >
                  <PdfIcon />
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-600">
                      Drop your menu PDF here, or <span className="text-[#FF5722]">click to browse</span>
                    </p>
                    <p className="mt-0.5 text-xs text-gray-400">PDF files only</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50">
                    <PdfIcon className="h-6 w-6 text-red-400" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">{file.name}</p>
                    <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(0)} KB</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold text-[#FF5722] hover:bg-orange-50"
                  >
                    Change
                  </button>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                aria-label="Upload menu PDF"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) pickFile(f)
                  e.target.value = ''
                }}
              />
            </>
          )}

          {/* ── Stage: reading ───────────────────────────────────────────────── */}
          {stage === 'reading' && (
            <div className="flex flex-col items-center justify-center gap-4 py-16">
              <Spinner className="h-10 w-10" />
              <p className="text-sm font-medium text-gray-600">Reading your menu…</p>
              <p className="text-xs text-gray-400">This can take up to a minute for large menus</p>
            </div>
          )}

          {/* ── Stage: preview ───────────────────────────────────────────────── */}
          {stage === 'preview' && (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700">
                  Found <span className="font-bold text-gray-900">{extracted.length}</span> dishes ·{' '}
                  <span className="text-[#FF5722]">{selectedCount} selected</span>
                </p>
                <button
                  type="button"
                  onClick={toggleAll}
                  className="text-xs font-semibold text-[#FF5722] hover:underline"
                >
                  {allChecked ? 'Deselect all' : 'Select all'}
                </button>
              </div>

              <div className="overflow-hidden rounded-xl border border-gray-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-400">
                    <tr>
                      <th className="w-10 px-3 py-2" scope="col" aria-label="Select" />
                      <th className="px-3 py-2 font-medium">Dish</th>
                      <th className="px-3 py-2 font-medium">Category</th>
                      <th className="px-3 py-2 text-center font-medium">Veg</th>
                      <th className="px-3 py-2 text-right font-medium">Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {extracted.map((d, i) => (
                      <tr key={i} className={checked[i] ? 'bg-white' : 'bg-gray-50/60'}>
                        <td className="px-3 py-2.5 align-top">
                          <input
                            type="checkbox"
                            checked={checked[i]}
                            onChange={() =>
                              setChecked(prev => prev.map((c, idx) => (idx === i ? !c : c)))
                            }
                            aria-label={`Import ${d.dish_name}`}
                            className="h-4 w-4 cursor-pointer accent-[#FF5722]"
                          />
                        </td>
                        <td className="px-3 py-2.5 align-top">
                          <p className="font-medium text-gray-900">{d.dish_name}</p>
                          {d.description && (
                            <p className="mt-0.5 line-clamp-2 text-xs text-gray-400">{d.description}</p>
                          )}
                        </td>
                        <td className="px-3 py-2.5 align-top text-gray-600">{d.category_name}</td>
                        <td className="px-3 py-2.5 text-center align-top">
                          <span
                            className={[
                              'inline-block h-2.5 w-2.5 rounded-full',
                              d.is_veg ? 'bg-green-500' : 'bg-red-500',
                            ].join(' ')}
                            title={d.is_veg ? 'Veg' : 'Non-Veg'}
                          />
                        </td>
                        <td className="px-3 py-2.5 text-right align-top font-medium text-gray-900">
                          ₹{d.price}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Stage: importing ─────────────────────────────────────────────── */}
          {stage === 'importing' && (
            <div className="flex flex-col items-center justify-center gap-4 py-16">
              <Spinner className="h-10 w-10" />
              <p className="text-sm font-medium text-gray-600">Importing dishes…</p>
            </div>
          )}

          {/* ── Stage: done ──────────────────────────────────────────────────── */}
          {stage === 'done' && (
            <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
              <CheckCircleIcon />
              <p className="text-base font-semibold text-gray-900">
                {importedCount} dish{importedCount === 1 ? '' : 'es'} imported!
              </p>
              <p className="text-sm text-gray-500">
                Your menu has been updated. New categories were created automatically where needed.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 border-t border-gray-100 px-6 py-4">
          {stage === 'idle' && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRead}
                disabled={!file}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#FF5722] py-3 text-sm font-bold text-white shadow-sm hover:opacity-90 disabled:opacity-40"
              >
                Read Menu
              </button>
            </>
          )}

          {stage === 'preview' && (
            <>
              <button
                type="button"
                onClick={() => { setStage('idle'); setExtracted([]); setChecked([]) }}
                className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={selectedCount === 0}
                className="flex flex-[2] items-center justify-center gap-2 rounded-xl bg-[#FF5722] py-3 text-sm font-bold text-white shadow-sm hover:opacity-90 disabled:opacity-40"
              >
                Import Selected ({selectedCount})
              </button>
            </>
          )}

          {stage === 'done' && (
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl bg-[#FF5722] py-3 text-sm font-bold text-white shadow-sm hover:opacity-90"
            >
              Done
            </button>
          )}

          {busy && (
            <button
              type="button"
              disabled
              className="flex-1 cursor-not-allowed rounded-xl bg-gray-100 py-3 text-sm font-medium text-gray-400"
            >
              Please wait…
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
