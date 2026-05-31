import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useCart } from '../context/CartContext'

interface Props {
  restaurantId: string
  tableId: string | null
}

type CallStatus = 'idle' | 'calling' | 'done'

const COOLDOWN_MS = 60_000 // 60 seconds between calls

function BellIcon() {
  return (
    <svg
      className="h-6 w-6"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg
      className="h-6 w-6"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

export default function WaiterCallButton({ restaurantId, tableId }: Props) {
  const { itemCount } = useCart()
  const [callStatus, setCallStatus] = useState<CallStatus>('idle')
  const [toast, setToast] = useState<string | null>(null)
  const lastCalledAtRef  = useRef<number>(0)
  const callingTimerRef  = useRef<ReturnType<typeof setTimeout>>()
  const doneTimerRef     = useRef<ReturnType<typeof setTimeout>>()
  const toastTimerRef    = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    return () => {
      clearTimeout(callingTimerRef.current)
      clearTimeout(doneTimerRef.current)
      clearTimeout(toastTimerRef.current)
    }
  }, [])

  function showToast(message: string) {
    setToast(message)
    clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToast(null), 3000)
  }

  function handleCall() {
    const now = Date.now()

    if (now - lastCalledAtRef.current < COOLDOWN_MS) {
      showToast('Your waiter is on the way')
      return
    }

    lastCalledAtRef.current = now
    setCallStatus('calling')

    // Fire-and-forget — analytics failure should never block the UI
    const payload = { event_type: 'waiter_call', restaurant_id: restaurantId, table_id: tableId ?? null }
    void supabase.from('analytics_events').insert(payload)

    clearTimeout(callingTimerRef.current)
    callingTimerRef.current = setTimeout(() => {
      setCallStatus('done')
      showToast('Waiter has been notified')

      clearTimeout(doneTimerRef.current)
      doneTimerRef.current = setTimeout(() => setCallStatus('idle'), 3000)
    }, 2000)
  }

  // Lift the button above the CartBar when the cart has items
  const bottomClass = itemCount > 0 ? 'bottom-20' : 'bottom-6'

  return (
    <>
      {/* Toast — sits below the status pill (top-4) to avoid overlap */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed left-1/2 top-16 z-[80] -translate-x-1/2 rounded-full bg-gray-900 px-5 py-2.5 shadow-xl"
        >
          <p className="whitespace-nowrap text-sm font-medium text-white">{toast}</p>
        </div>
      )}

      <button
        type="button"
        onClick={handleCall}
        disabled={callStatus === 'calling'}
        aria-label="Call waiter"
        className={[
          'fixed right-4 z-40 flex flex-col items-center rounded-2xl px-4 py-3 shadow-lg transition-all duration-200 active:scale-95 disabled:cursor-not-allowed',
          bottomClass,
          callStatus === 'idle'
            ? 'border-2 border-[#FF5722] bg-white text-[#FF5722]'
            : 'bg-[#FF5722] text-white',
        ].join(' ')}
      >
        {callStatus === 'done' ? <CheckIcon /> : <BellIcon />}
        <span className="mt-1 text-xs font-semibold leading-none">
          {callStatus === 'idle'
            ? 'Call Waiter'
            : callStatus === 'calling'
              ? 'Calling...'
              : 'Notified ✓'}
        </span>
      </button>
    </>
  )
}
