/**
 * useProjects — Query hook for projects
 * Supports filtering by status and search
 */
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase'
import { projectKeys } from './projectKeys'
import type { Project } from '../../../types/project'

interface UseProjectsOptions {
  status?: string
  search?: string
  activeOnly?: boolean
}

export function useProjects({ status, search = '', activeOnly = false }: UseProjectsOptions = {}) {
  return useQuery({
    queryKey: status || search || activeOnly ? [
      ...projectKeys.list(),
      ...(status ? ['status', status] : []),
      ...(search ? ['search', search] : []),
      ...(activeOnly ? ['active'] : []),
    ] : projectKeys.list(),
    queryFn: async () => {
      let query = supabase.from('projects').select('*')

      if (status) {
        query = query.eq('status', status)
      }

      if (activeOnly) {
        query = query.eq('status', 'active')
      }

      if (search) {
        query = query.ilike('name', `%${search}%`)
      }

      const { data, error } = await query.order('created_at', { ascending: false })

      if (error) throw error
      return data as Project[]
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

export function useProjectDetail(id: number) {
  return useQuery({
    queryKey: projectKeys.detail(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error
      return data as Project
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!id,
  })
}
