/**
 * useProjects — Query hook for projects
 * Supports filtering by status and search
 */
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase'
import { projectKeys } from './projectKeys'
import type { Project } from '../../../types/project'

const PROJECT_SELECT = '*, general_contractors(company_name)'

type ProjectRow = Project & {
  general_contractors?: { company_name: string } | null
}

function mapProject(row: ProjectRow): Project {
  const { general_contractors, ...project } = row
  return {
    ...project,
    general_contractor: general_contractors?.company_name ?? project.general_contractor,
  }
}

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
      let query = supabase.from('projects').select(PROJECT_SELECT)

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
      return (data as ProjectRow[]).map(mapProject)
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
        .select(PROJECT_SELECT)
        .eq('id', id)
        .single()

      if (error) throw error
      return mapProject(data as ProjectRow)
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!id,
  })
}
