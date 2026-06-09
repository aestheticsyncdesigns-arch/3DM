import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import { useRestaurant } from '../hooks/useRestaurant'

const GST_SLABS = [0, 5, 12, 18]

function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin`} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="rgba(0,0,0,0.1)" strokeWidth="4" />
      <path fill="#FF5722" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

export default function SettingsPage() {
  const { restaurant, isLoading } = useRestaurant()

  const [gstSlab, setGstSlab] = useState<number>(5)
  const [gstin,   setGstin]   = useState('')
  const [address, setAddress] = useState('')
  const [hsnCode, setHsnCode] = useState('996331')

  const [saving,  setSaving]  = useState(false)
  const [savedAt, setSavedAt] = useState(0)
  const [error,   setError]   = useState<string | null>(null)

  // Initialise the form once the restaurant row loads.
  useEffect(() => {
    if (!restaurant) return
    setGstSlab(restaurant.gst_slab != null ? Number(restaurant.gst_slab) : 5)
    setGstin(restaurant.gstin ?? '')
    setAddress(restaurant.address ?? '')
    setHsnCode(restaurant.hsn_code ?? '996331')
  }, [restaurant])

  async function handleSave() {
    if (!restaurant?.id) return
    setSaving(true)
    setError(null)
    const { error: err } = await supabase
      .from('restaurants')
      .update({
        gst_slab: gstSlab,
        gstin:    gstin.trim() || null,
        address:  address.trim() || null,
        hsn_code: hsnCode.trim() || '996331',
      })
      .eq('id', restaurant.id)
    setSaving(false)
    if (err) { setError(err.message); return }
    setSavedAt(Date.now())
    setTimeout(() => setSavedAt(0), 3000)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Billing Settings</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          These details appear on every GST invoice generated for your orders.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
      )}

      <div className="space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        {/* GST slab */}
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">GST Slab</label>
          <div className="flex flex-wrap gap-2">
            {GST_SLABS.map((slab) => (
              <button
                key={slab}
                type="button"
                onClick={() => setGstSlab(slab)}
                className={[
                  'rounded-xl border px-5 py-2.5 text-sm font-bold transition-all',
                  gstSlab === slab
                    ? 'border-[#FF5722] bg-[#FF5722] text-white shadow-sm'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300',
                ].join(' ')}
              >
                {slab}%
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-400">
            Split equally as CGST {gstSlab / 2}% + SGST {gstSlab / 2}% on each bill.
          </p>
        </div>

        {/* GSTIN */}
        <div>
          <label htmlFor="gstin" className="mb-1.5 block text-sm font-medium text-gray-700">GSTIN</label>
          <input
            id="gstin"
            type="text"
            value={gstin}
            onChange={(e) => setGstin(e.target.value.toUpperCase())}
            placeholder="22AAAAA0000A1Z5"
            maxLength={15}
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm uppercase tracking-wide text-gray-900 outline-none focus:border-[#FF5722] focus:bg-white"
          />
        </div>

        {/* Address */}
        <div>
          <label htmlFor="address" className="mb-1.5 block text-sm font-medium text-gray-700">
            Restaurant Address
          </label>
          <textarea
            id="address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            rows={3}
            placeholder="Full address as it should appear on the invoice"
            className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none focus:border-[#FF5722] focus:bg-white"
          />
        </div>

        {/* HSN code */}
        <div>
          <label htmlFor="hsn" className="mb-1.5 block text-sm font-medium text-gray-700">HSN / SAC Code</label>
          <input
            id="hsn"
            type="text"
            value={hsnCode}
            onChange={(e) => setHsnCode(e.target.value)}
            placeholder="996331"
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none focus:border-[#FF5722] focus:bg-white"
          />
          <p className="mt-2 text-xs text-gray-400">Default 996331 — restaurant / catering services.</p>
        </div>

        {/* Save */}
        <div className="flex items-center gap-3 border-t border-gray-100 pt-5">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center justify-center gap-2 rounded-xl bg-[#FF5722] px-6 py-3 text-sm font-bold text-white shadow-sm hover:opacity-90 disabled:opacity-70"
          >
            {saving && <Spinner className="h-4 w-4" />}
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
          {savedAt > 0 && (
            <span className="text-sm font-medium text-green-600">✓ Saved</span>
          )}
        </div>
      </div>
    </div>
  )
}
