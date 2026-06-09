import { useCallback, useEffect, useRef } from 'react'

export interface BeepTone {
  /** start offset in seconds */
  t: number
  /** frequency in Hz */
  f: number
}

function getAudioCtor(): typeof AudioContext | undefined {
  return (
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  )
}

/**
 * Returns a stable playBeep() that plays a sequence of soft sine tones through
 * the Web Audio API (no external files). The AudioContext is unlocked on the
 * first pointer interaction to satisfy browser autoplay policies.
 *
 * Pass distinct tone sets to make different events sound different.
 */
export function useBeep(tones: BeepTone[]) {
  const ctxRef = useRef<AudioContext | null>(null)
  const tonesRef = useRef(tones)
  tonesRef.current = tones

  // Unlock on first interaction so audio can play on mobile / strict autoplay.
  useEffect(() => {
    function unlock() {
      const Ctor = getAudioCtor()
      if (!ctxRef.current && Ctor) ctxRef.current = new Ctor()
      void ctxRef.current?.resume()
      window.removeEventListener('pointerdown', unlock)
    }
    window.addEventListener('pointerdown', unlock)
    return () => window.removeEventListener('pointerdown', unlock)
  }, [])

  return useCallback(() => {
    try {
      const Ctor = getAudioCtor()
      if (!Ctor) return
      let ctx = ctxRef.current
      if (!ctx) {
        ctx = new Ctor()
        ctxRef.current = ctx
      }
      if (ctx.state === 'suspended') void ctx.resume()

      const start = ctx.currentTime
      for (const { t, f } of tonesRef.current) {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.value = f
        gain.gain.setValueAtTime(0.0001, start + t)
        gain.gain.linearRampToValueAtTime(0.16, start + t + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.0001, start + t + 0.16)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(start + t)
        osc.stop(start + t + 0.18)
      }
    } catch {
      /* audio not available — ignore */
    }
  }, [])
}
