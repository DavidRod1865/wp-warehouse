/**
 * useItemMovements — Fetch inventory movement ledger
 *
 * Supports filtering by item or external reference.
 */
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase'
import { inventoryKeys } from './inventoryKeys'
import type { InventoryMovement } from '../types'

interface UseItemMovementsOptions {
  limit?: number
  joinData?: boolean
}

async function fetchItemMovements(
  itemId: number,
  options?: UseItemMovementsOptions
): Promise<InventoryMovement[]> {
  const limit = options?.limit || 50

  const { data, error } = await supabase
    .from('inventory_movements')
    .select('*')
    .eq('item_id', itemId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data || []) as InventoryMovement[]
}

export function useItemMovements(
  itemId: number | null | undefined,
  options?: UseItemMovementsOptions
) {
  return useQuery({
    queryKey: inventoryKeys.movementsByItem(itemId!),
    queryFn: () => fetchItemMovements(itemId!, options),
    enabled: !!itemId,
    staleTime: 1 * 60 * 1000,
  })
}

async function fetchMovementsByReference(
  referenceType: string,
  referenceId: number
): Promise<InventoryMovement[]> {
  const { data, error } = await supabase
    .from('inventory_movements')
    .select('*')
    .eq('reference_type', referenceType)
    .eq('reference_id', referenceId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data || []) as InventoryMovement[]
}

export function useMovementsByReference(
  referenceType: string | null | undefined,
  referenceId: number | null | undefined
) {
  return useQuery({
    queryKey: inventoryKeys.movementsByReference(referenceType!, referenceId!),
    queryFn: () => fetchMovementsByReference(referenceType!, referenceId!),
    enabled: !!referenceType && !!referenceId,
    staleTime: 1 * 60 * 1000,
  })
}
