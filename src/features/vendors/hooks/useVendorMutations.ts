/**
 * useVendorMutations — Mutations for creating, updating, and toggling vendors
 * Note: No delete operation; deactivate via is_active instead
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase'
import { vendorKeys } from './vendorKeys'
import type { Vendor } from './useVendors'
import type { VendorFormValues } from '../schemas/vendorSchema'

export type { Vendor }

export function useCreateVendor() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (values: VendorFormValues) => {
      const { data, error } = await supabase
        .from('vendors')
        .insert([
          {
            name: values.name,
            contact_name: values.contact_name || null,
            phone: values.phone || null,
            email: values.email || null,
            address: values.address || null,
            notes: values.notes || null,
            is_active: true,
          },
        ])
        .select()
        .single()

      if (error) throw error
      return data as Vendor
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vendorKeys.all })
    },
  })
}

export function useUpdateVendor() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      values,
    }: {
      id: number
      values: VendorFormValues
    }) => {
      const { data, error } = await supabase
        .from('vendors')
        .update({
          name: values.name,
          contact_name: values.contact_name || null,
          phone: values.phone || null,
          email: values.email || null,
          address: values.address || null,
          notes: values.notes || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as Vendor
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: vendorKeys.all })
      queryClient.invalidateQueries({ queryKey: vendorKeys.detail(id) })
    },
  })
}

export function useToggleVendorActive() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const { data, error } = await supabase
        .from('vendors')
        .update({
          is_active: isActive,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as Vendor
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: vendorKeys.all })
      queryClient.invalidateQueries({ queryKey: vendorKeys.detail(id) })
    },
  })
}
