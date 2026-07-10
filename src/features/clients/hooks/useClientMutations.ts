/**
 * useClientMutations — Mutations for creating, updating, and toggling clients
 * Note: No delete operation; deactivate via is_active instead
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase'
import { clientKeys } from './clientKeys'
import type { GeneralContractor } from './useClients'
import type { ClientFormValues } from '../schemas/clientSchema'

export type { GeneralContractor }

export function useCreateClient() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (values: ClientFormValues) => {
      const { data, error } = await supabase
        .from('general_contractors')
        .insert([
          {
            company_name: values.company_name,
            contact_name: values.contact_name || null,
            phone: values.phone || null,
            email: values.email || null,
            billing_address: values.billing_address || null,
            notes: values.notes || null,
            is_active: true,
          },
        ])
        .select()
        .single()

      if (error) throw error
      return data as GeneralContractor
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientKeys.all })
    },
  })
}

export function useUpdateClient() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      values,
    }: {
      id: number
      values: ClientFormValues
    }) => {
      const { data, error } = await supabase
        .from('general_contractors')
        .update({
          company_name: values.company_name,
          contact_name: values.contact_name || null,
          phone: values.phone || null,
          email: values.email || null,
          billing_address: values.billing_address || null,
          notes: values.notes || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as GeneralContractor
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: clientKeys.all })
      queryClient.invalidateQueries({ queryKey: clientKeys.detail(id) })
    },
  })
}

export function useToggleClientActive() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const { data, error } = await supabase
        .from('general_contractors')
        .update({
          is_active: isActive,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as GeneralContractor
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: clientKeys.all })
      queryClient.invalidateQueries({ queryKey: clientKeys.detail(id) })
    },
  })
}
