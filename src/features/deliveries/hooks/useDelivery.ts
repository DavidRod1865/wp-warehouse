/**
 * useDelivery — Fetch a single delivery with its items
 *
 * Combines what was previously two separate fetches
 * (delivery detail + delivery items) into one hook.
 */
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase'
import { deliveryKeys } from './deliveryKeys'
import type { Delivery, DeliveryItem, DeliveryConfirmation } from '../types'

async function fetchDeliveryDetail(id: number): Promise<Delivery> {
  const { data, error } = await supabase
    .from('deliveries')
    .select(`
      *,
      projects (name, sortly_jobsite_folder_id, sortly_warehouse_folder_id)
    `)
    .eq('id', id)
    .single()

  if (error) throw error
  return data as unknown as Delivery
}

async function fetchDeliveryItems(deliveryId: number): Promise<DeliveryItem[]> {
  const { data, error } = await supabase
    .from('delivery_items')
    .select('*')
    .eq('delivery_id', deliveryId)

  if (error) throw error
  return (data || []) as DeliveryItem[]
}

async function fetchDeliveryConfirmation(deliveryId: number): Promise<DeliveryConfirmation | null> {
  const { data, error } = await supabase
    .from('delivery_confirmations')
    .select('*')
    .eq('delivery_id', deliveryId)
    .single()

  // PGRST116 = no rows found — not an error for optional confirmation
  if (error && error.code !== 'PGRST116') throw error
  return (data || null) as DeliveryConfirmation | null
}

export function useDelivery(id: number | null | undefined) {
  return useQuery({
    queryKey: deliveryKeys.detail(id!),
    queryFn: () => fetchDeliveryDetail(id!),
    enabled: !!id,
  })
}

export function useDeliveryItems(deliveryId: number | null | undefined) {
  return useQuery({
    queryKey: deliveryKeys.items(deliveryId!),
    queryFn: () => fetchDeliveryItems(deliveryId!),
    enabled: !!deliveryId,
  })
}

export function useDeliveryConfirmation(deliveryId: number | null | undefined) {
  return useQuery({
    queryKey: deliveryKeys.confirmation(deliveryId!),
    queryFn: () => fetchDeliveryConfirmation(deliveryId!),
    enabled: !!deliveryId,
  })
}
