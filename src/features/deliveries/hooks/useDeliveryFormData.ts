/**
 * useDeliveryFormData — Loads dropdown data for the delivery form
 *
 * Phase 5+: Projects from Supabase; trucks and warehouse areas from the
 * first-party locations table via useLocations. No Sortly.
 */
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase'
import { useLocations } from '../../inventory/hooks/useLocations'
import type { Project } from '../../../types/project'

async function fetchProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('status', 'active')
    .order('name')

  if (error) throw error
  return (data || []) as Project[]
}

export function useDeliveryFormData() {
  const projectsQuery = useQuery({
    queryKey: ['form', 'projects'],
    queryFn: fetchProjects,
    staleTime: 5 * 60 * 1000,
  })

  const trucksQuery = useLocations({ type: 'truck' })
  const warehouseLocationsQuery = useLocations({ type: 'warehouse_area' })

  return {
    projects: projectsQuery.data || [],
    trucks: (trucksQuery.data || []).map((l) => ({ id: l.id, name: l.name })),
    warehouseLocations: (warehouseLocationsQuery.data || []).map((l) => ({ id: l.id, name: l.name })),
    isLoading:
      projectsQuery.isLoading ||
      trucksQuery.isLoading ||
      warehouseLocationsQuery.isLoading,
    error: projectsQuery.error || trucksQuery.error || warehouseLocationsQuery.error,
  }
}
