/**
 * useLocations — Fetch locations with optional filtering
 *
 * Supports filtering by type (warehouse_area | truck | job_site) and active status.
 */
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase'
import { inventoryKeys } from './inventoryKeys'
import type { Location } from '../types'

interface UseLocationsOptions {
  type?: 'warehouse_area' | 'truck' | 'job_site' | 'rigging_yard'
  activeOnly?: boolean
}

async function fetchLocations(options?: UseLocationsOptions): Promise<Location[]> {
  let query = supabase.from('locations').select('*')

  if (options?.type) {
    query = query.eq('location_type', options.type)
  }

  if (options?.activeOnly !== false) {
    query = query.eq('is_active', true)
  }

  query = query.order('name', { ascending: true })

  const { data, error } = await query

  if (error) throw error
  return data || []
}

export function useLocations(options?: UseLocationsOptions) {
  return useQuery({
    queryKey: options?.type ? inventoryKeys.locationsByType(options.type) : inventoryKeys.locations(),
    queryFn: () => fetchLocations(options),
    staleTime: 5 * 60 * 1000,
  })
}

export function useLocationDetail(id: number | null | undefined) {
  return useQuery({
    queryKey: inventoryKeys.locationDetail(id!),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('id', id!)
        .single()

      if (error) throw error
      return data as Location
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  })
}
