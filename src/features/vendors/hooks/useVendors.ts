/**
 * useVendors — Query hook for vendors
 * Supports filtering by active status and search
 */
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase'
import { vendorKeys } from './vendorKeys'

export interface Vendor {
  id: number
  name: string
  contact_name?: string | null
  phone?: string | null
  email?: string | null
  address?: { street?: string; city?: string; state?: string; zip?: string; notes?: string } | null
  notes?: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

interface UseVendorsOptions {
  activeOnly?: boolean
  search?: string
}

export function useVendors({ activeOnly = false, search = '' }: UseVendorsOptions = {}) {
  return useQuery({
    queryKey: activeOnly || search ? [
      ...vendorKeys.list(),
      ...(activeOnly ? ['active'] : []),
      ...(search ? ['search', search] : []),
    ] : vendorKeys.list(),
    queryFn: async () => {
      let query = supabase.from('vendors').select('*')

      if (activeOnly) {
        query = query.eq('is_active', true)
      }

      if (search) {
        query = query.ilike('name', `%${search}%`)
      }

      const { data, error } = await query.order('name', { ascending: true })

      if (error) throw error
      return data as Vendor[]
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

export function useVendorDetail(id: number) {
  return useQuery({
    queryKey: vendorKeys.detail(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error
      return data as Vendor
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!id,
  })
}
