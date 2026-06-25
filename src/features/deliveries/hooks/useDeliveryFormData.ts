/**
 * useDeliveryFormData — Loads dropdown data for the delivery form
 *
 * Fetches projects from Supabase and trucks (Sortly folders under
 * the "Delivery Trucks" parent) for the form selects.
 *
 * Folder IDs come from the app_config table via useAppConfig,
 * replacing the old hardcoded TRUCKS_FOLDER_ID constant.
 */
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase'
import { sortlyClient } from '../../../lib/sortly'
import { useAppConfig } from '../../../hooks/useAppConfig'
import type { SortlyItem } from '../../../types/sortly'
import type { Project } from '../../../types/project'

interface Truck {
  id: number
  name: string
}

async function fetchProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('status', 'active')
    .order('name')

  if (error) throw error
  return (data || []) as Project[]
}

async function fetchTrucks(trucksFolderId: number): Promise<Truck[]> {
  const allTrucks: SortlyItem[] = []
  let page = 1
  let hasMore = true

  while (hasMore) {
    const response = await sortlyClient.listItems({
      folder_id: trucksFolderId,
      type: 'folder',
      per_page: 100,
      page,
    })
    if (response.data && response.data.length > 0) {
      allTrucks.push(...response.data)
      hasMore = response.data.length === 100
      page++
    } else {
      hasMore = false
    }
  }

  return allTrucks.map((t) => ({ id: t.id, name: t.name }))
}

export function useDeliveryFormData() {
  const { data: appConfig, isLoading: configLoading } = useAppConfig()

  const projectsQuery = useQuery({
    queryKey: ['form', 'projects'],
    queryFn: fetchProjects,
    staleTime: 5 * 60 * 1000,
  })

  const trucksQuery = useQuery({
    queryKey: ['form', 'trucks', appConfig?.deliveryTrucksFolderId],
    queryFn: () => fetchTrucks(appConfig!.deliveryTrucksFolderId!),
    enabled: !!appConfig?.deliveryTrucksFolderId,
    staleTime: 5 * 60 * 1000,
  })

  return {
    projects: projectsQuery.data || [],
    trucks: trucksQuery.data || [],
    mainWarehouseFolderId: appConfig?.mainWarehouseFolderId ?? null,
    isLoading: configLoading || projectsQuery.isLoading || trucksQuery.isLoading,
    error: projectsQuery.error || trucksQuery.error,
  }
}
