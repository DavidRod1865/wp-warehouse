import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase'
import type { Project } from '../../../types/project'

async function fetchActiveProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('status', 'active')
    .order('name')

  if (error) throw error
  return (data || []) as Project[]
}

export function useActiveProjects() {
  return useQuery({
    queryKey: ['form', 'projects'],
    queryFn: fetchActiveProjects,
    staleTime: 5 * 60 * 1000,
  })
}
