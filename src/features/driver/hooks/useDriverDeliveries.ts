/**
 * useDriverDeliveries — Fetch deliveries assigned to the current driver.
 *
 * Active deliveries: status IN ('pending', 'in_transit')
 * Completed deliveries: status = 'delivered' (recent 10)
 */
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase'
import { driverKeys } from './driverKeys'
import type { Delivery, DeliveryItem } from '../../deliveries/types'

async function fetchDriverDeliveries(driverId: string): Promise<{
  active: Delivery[]
  completed: Delivery[]
}> {
  const { data, error } = await supabase
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
      truck_name,
      activity_log,
      projects (name)
    `)
    .eq('driver_id', driverId)
    .in('status', ['pending', 'in_transit', 'delivered'])
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) throw error

  const all = (data || []) as unknown as Delivery[]
  return {
    active: all.filter((d) => d.status === 'pending' || d.status === 'in_transit'),
    completed: all.filter((d) => d.status === 'delivered').slice(0, 10),
  }
}

export function useDriverDeliveries(driverId: string | undefined) {
  return useQuery({
    queryKey: driverKeys.deliveries(driverId!),
    queryFn: () => fetchDriverDeliveries(driverId!),
    enabled: !!driverId,
    staleTime: 30 * 1000,
  })
}

async function fetchDriverDelivery(id: number): Promise<Delivery> {
  const { data, error } = await supabase
    .from('deliveries')
    .select(`
      *,
      projects (name)
    `)
    .eq('id', id)
    .single()

  if (error) throw error
  return data as unknown as Delivery
}

async function fetchDriverDeliveryItems(deliveryId: number): Promise<DeliveryItem[]> {
  const { data, error } = await supabase
    .from('delivery_items')
    .select('*')
    .eq('delivery_id', deliveryId)

  if (error) throw error
  return (data || []) as DeliveryItem[]
}

export function useDriverDelivery(id: number | null | undefined) {
  return useQuery({
    queryKey: driverKeys.delivery(id!),
    queryFn: () => fetchDriverDelivery(id!),
    enabled: !!id,
  })
}

export function useDriverDeliveryItems(deliveryId: number | null | undefined) {
  return useQuery({
    queryKey: driverKeys.deliveryItems(deliveryId!),
    queryFn: () => fetchDriverDeliveryItems(deliveryId!),
    enabled: !!deliveryId,
  })
}
