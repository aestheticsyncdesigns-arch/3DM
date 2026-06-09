import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Database } from '@3dm/shared'
import { supabase } from '../supabase'

export type StaffRow = Database['public']['Tables']['staff']['Row']
export type StaffRole = 'waiter' | 'chef' | 'manager'

export interface StaffInput {
  name: string
  role: StaffRole
  pin: string
  phone: string | null
}

const staffKey = (restaurantId: string | undefined) => ['staff', restaurantId]

/** All staff for the restaurant, newest first. Owner-only (authenticated). */
export function useStaff(restaurantId: string | undefined) {
  return useQuery<StaffRow[]>({
    queryKey: staffKey(restaurantId),
    queryFn: async () => {
      if (!restaurantId) return []
      const { data, error } = await supabase
        .from('staff')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data ?? []
    },
    enabled: !!restaurantId,
  })
}

export function useCreateStaff(restaurantId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: StaffInput) => {
      if (!restaurantId) throw new Error('No restaurant')
      const { error } = await supabase.from('staff').insert({
        restaurant_id: restaurantId,
        name: input.name,
        role: input.role,
        pin: input.pin,
        phone: input.phone,
        is_active: true,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: staffKey(restaurantId) }),
  })
}

export function useUpdateStaff(restaurantId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<StaffInput> & { is_active?: boolean } }) => {
      const { error } = await supabase.from('staff').update(patch).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: staffKey(restaurantId) }),
  })
}

export function useDeleteStaff(restaurantId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('staff').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: staffKey(restaurantId) }),
  })
}
