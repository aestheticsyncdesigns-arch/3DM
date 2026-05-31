import { useEffect, useState } from 'react'
import type { Database } from '@3dm/shared'
import { supabase } from '../supabase'

export type Restaurant = Database['public']['Tables']['restaurants']['Row']

export function useRestaurant() {
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [isLoading, setIsLoading]   = useState(true)
  const [error, setError]           = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      const userId = session?.user?.id
      if (!userId) { setIsLoading(false); return }

      // ── 1. Look for a restaurant this user already owns ─────────────────────
      const { data: owned, error: ownedErr } = await supabase
        .from('restaurants')
        .select('*')
        .eq('owner_id', userId)
        .limit(1)
        .maybeSingle()

      if (ownedErr) { setError(ownedErr.message); setIsLoading(false); return }

      if (owned) {
        setRestaurant(owned)
        setIsLoading(false)
        return
      }

      // ── 2. Try to claim an unclaimed restaurant (owner_id IS NULL) ──────────
      // Requires migration 008 — policies "restaurants: claim unclaimed select/update".
      const { data: unclaimed } = await supabase
        .from('restaurants')
        .select('*')
        .is('owner_id', null)
        .limit(1)
        .maybeSingle()

      if (unclaimed) {
        const { data: claimed, error: claimErr } = await supabase
          .from('restaurants')
          .update({ owner_id: userId })
          .eq('id', unclaimed.id)
          .select()
          .maybeSingle()

        if (claimErr) {
          console.warn('[useRestaurant] Could not claim restaurant:', claimErr.message)
        } else if (claimed) {
          setRestaurant(claimed)
          setIsLoading(false)
          return
        }
      }

      // ── 3. Check for pending restaurant data saved at signup time ───────────
      // SignupPage stores form data here when email confirmation is required
      // and there's no session yet to perform the insert.
      const pendingKey = `pending_restaurant_${userId}`
      const pendingJson = localStorage.getItem(pendingKey)
      if (pendingJson) {
        try {
          const pending = JSON.parse(pendingJson) as {
            name: string; subdomain: string; phone: string; gstin: string | null
          }
          const { data: created, error: insertErr } = await supabase
            .from('restaurants')
            .insert({ ...pending, owner_id: userId })
            .select()
            .maybeSingle()

          if (insertErr) {
            console.warn('[useRestaurant] Could not create pending restaurant:', insertErr.message)
          } else if (created) {
            localStorage.removeItem(pendingKey)
            setRestaurant(created)
            setIsLoading(false)
            return
          }
        } catch {
          localStorage.removeItem(pendingKey)
        }
      }

      setIsLoading(false)
    }

    void load()
  }, [])

  return { restaurant, isLoading, error }
}
