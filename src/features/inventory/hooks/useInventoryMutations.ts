/**
 * useInventoryMutations — Mutations for inventory operations
 *
 * Supports:
 * - createItem / updateItem (direct table writes)
 * - createLocation / updateLocation (direct table writes)
 * - moveInventory / adjustInventory (RPC calls with built-in atomicity)
 *
 * All mutations invalidate appropriate cache keys on success.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase'
import { inventoryKeys } from './inventoryKeys'
import type { InventoryItem, Location } from '../types'

// ============================================================================
// ITEM MUTATIONS
// ============================================================================

export interface CreateItemInput {
  name: string
  part_number?: string
  description?: string
  unit_cost?: number
}

export interface UpdateItemInput extends CreateItemInput {
  id: number
}

export function useCreateItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateItemInput) => {
      const { data, error } = await supabase.from('items').insert(input).select().single()

      if (error) throw error
      return data as InventoryItem
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.items() })
    },
  })
}

export function useUpdateItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: UpdateItemInput) => {
      const { id, ...updates } = input

      const { data, error } = await supabase
        .from('items')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as InventoryItem
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.items() })
      queryClient.invalidateQueries({ queryKey: inventoryKeys.itemDetail(data.id) })
    },
  })
}

// ============================================================================
// LOCATION MUTATIONS
// ============================================================================

export interface CreateLocationInput {
  name: string
  location_type: 'warehouse_area' | 'truck' | 'job_site'
  parent_location_id?: number | null
  address?: Record<string, string> | null
  is_active?: boolean
}

export interface UpdateLocationInput extends CreateLocationInput {
  id: number
}

export function useCreateLocation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateLocationInput) => {
      const { data, error } = await supabase
        .from('locations')
        .insert(input)
        .select()
        .single()

      if (error) throw error
      return data as Location
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.locations() })
    },
  })
}

export function useUpdateLocation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: UpdateLocationInput) => {
      const { id, ...updates } = input

      const { data, error } = await supabase
        .from('locations')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as Location
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: inventoryKeys.locations() })
      queryClient.invalidateQueries({ queryKey: inventoryKeys.locationDetail(data.id) })
    },
  })
}

// ============================================================================
// INVENTORY MOVEMENT MUTATIONS (via RPC)
// ============================================================================

export interface MoveInventoryInput {
  item_id: number
  quantity: number
  movement_type: 'receive' | 'transfer' | 'load_truck' | 'deliver' | 'adjust'
  from_location_id?: number | null
  to_location_id?: number | null
  reference_type?: string | null
  reference_id?: number | null
  notes?: string | null
}

export interface AdjustInventoryInput {
  location_id: number
  item_id: number
  new_quantity: number
  reason: string
  notes?: string | null
}

export function useMoveInventory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: MoveInventoryInput) => {
      const { data, error } = await supabase.rpc('move_inventory', {
        p_item_id: input.item_id,
        p_quantity: input.quantity,
        p_movement_type: input.movement_type,
        p_from_location_id: input.from_location_id || null,
        p_to_location_id: input.to_location_id || null,
        p_reference_type: input.reference_type || null,
        p_reference_id: input.reference_id || null,
        p_notes: input.notes || null,
      })

      if (error) throw error
      return data
    },
    onSuccess: () => {
      // Invalidate all stock and movement caches
      queryClient.invalidateQueries({ queryKey: inventoryKeys.stockLevels() })
      queryClient.invalidateQueries({ queryKey: inventoryKeys.allStockByItem() })
      queryClient.invalidateQueries({ queryKey: inventoryKeys.movements() })
    },
  })
}

export function useAdjustInventory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: AdjustInventoryInput) => {
      const { data, error } = await supabase.rpc('adjust_inventory', {
        p_location_id: input.location_id,
        p_item_id: input.item_id,
        p_new_quantity: input.new_quantity,
        p_reason: input.reason,
        p_notes: input.notes || null,
      })

      if (error) throw error
      return data
    },
    onSuccess: () => {
      // Invalidate all stock and movement caches
      queryClient.invalidateQueries({ queryKey: inventoryKeys.stockLevels() })
      queryClient.invalidateQueries({ queryKey: inventoryKeys.allStockByItem() })
      queryClient.invalidateQueries({ queryKey: inventoryKeys.movements() })
    },
  })
}
