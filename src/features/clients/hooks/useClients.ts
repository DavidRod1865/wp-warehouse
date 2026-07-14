/**
 * useClients — Query hook for general contractors (clients)
 * Supports filtering by active status and search
 */
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase'
import { clientKeys } from './clientKeys'

export interface GeneralContractor {
  id: number
  company_name: string
  contact_name?: string | null
  phone?: string | null
  email?: string | null
  billing_address?: { street?: string; city?: string; state?: string; zip?: string; notes?: string } | null
  notes?: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

interface UseClientsOptions {
  activeOnly?: boolean
  search?: string
}

export function useClients({ activeOnly = false, search = '' }: UseClientsOptions = {}) {
  return useQuery({
    queryKey: activeOnly || search ? [
      ...clientKeys.list(),
      ...(activeOnly ? ['active'] : []),
      ...(search ? ['search', search] : []),
    ] : clientKeys.list(),
    queryFn: async () => {
      let query = supabase.from('general_contractors').select('*')

      if (activeOnly) {
        query = query.eq('is_active', true)
      }

      if (search) {
        query = query.ilike('company_name', `%${search}%`)
      }

      const { data, error } = await query.order('company_name', { ascending: true })

      if (error) throw error
      return data as GeneralContractor[]
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

export function useClientDetail(id: number) {
  return useQuery({
    queryKey: clientKeys.detail(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('general_contractors')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error
      return data as GeneralContractor
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!id,
  })
}

export function useClientProjects(gcId: number) {
  return useQuery({
    queryKey: clientKeys.detailProjects(gcId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('gc_id', gcId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as any[]
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!gcId,
  })
}
