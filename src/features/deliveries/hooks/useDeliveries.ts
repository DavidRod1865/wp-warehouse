/**
 * useDeliveries — Fetch delivery list with filtering
 *
 * Replaces the old Dashboard's manual fetchDeliveries() + useState pattern.
 * Supports filtering by status, project, truck, and date.
 */
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase'
import { deliveryKeys } from './deliveryKeys'
import type { Delivery, DeliveryStatus } from '../types'

export interface DeliveryFilters {
  status?: DeliveryStatus | 'all'
  projectId?: number | null
  truckId?: number | null
  date?: string
}

async function fetchDeliveries(filters: DeliveryFilters): Promise<Delivery[]> {
  let query = supabase
    .from('deliveries')
    .select(`
      id,
      delivery_number,
      po_reference,
      project_id,
      driver_id,
      status,
      created_at,
      started_at,
      delivered_at,
      from_address,
      to_address,
      from_location_id,
      truck_sortly_folder_id,
      from_location_type,
      truck_name,
      delivery_type,
      signature_name,
      signature_data,
      activity_log,
      projects (name)
    `)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (filters.status && filters.status !== 'all') {
    query = query.eq('status', filters.status)
  }

  if (filters.projectId) {
    query = query.eq('project_id', filters.projectId)
  }

  if (filters.truckId) {
    query = query.eq('truck_sortly_folder_id', filters.truckId)
  }

  if (filters.date) {
    const startOfDay = new Date(filters.date)
    const endOfDay = new Date(filters.date)
    endOfDay.setDate(endOfDay.getDate() + 1)
    query = query
      .gte('created_at', startOfDay.toISOString())
      .lt('created_at', endOfDay.toISOString())
  }

  const { data, error } = await query

  if (error) throw error
  return (data || []) as unknown as Delivery[]
}

export function useDeliveries(filters: DeliveryFilters = {}) {
  return useQuery({
    queryKey: deliveryKeys.list(filters),
    queryFn: () => fetchDeliveries(filters),
    staleTime: 30 * 1000, // 30 seconds — deliveries change frequently
  })
}
