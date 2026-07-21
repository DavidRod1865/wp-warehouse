/**
 * useProjectStockLevels — Stock + overstock returns for a single project
 *
 * A project owns exactly 3 locations (job_site, rigging_yard, and a
 * warehouse_area staging location — see ensure_project_locations RPC).
 * These hooks fetch stock and return-movement history scoped to those
 * locations for the project detail page's Inventory tab.
 */
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase'
import { inventoryKeys } from './inventoryKeys'
import type { StockLevel, Location, InventoryMovement } from '../types'

export type ProjectStockLevel = StockLevel & {
  item: { name: string; part_number: string | null } | null
  location: Pick<Location, 'id' | 'name' | 'location_type' | 'project_id'>
}

async function fetchProjectStockLevels(projectId: number): Promise<ProjectStockLevel[]> {
  const { data, error } = await supabase
    .from('stock_levels')
    .select('*, items(name, part_number), locations!inner(id, name, location_type, project_id)')
    .eq('locations.project_id', projectId)

  if (error) throw error
  return ((data || []) as unknown[]).map((row) => {
    const r = row as Record<string, unknown>
    return {
      ...r,
      item: r.items ?? null,
      location: r.locations,
    } as ProjectStockLevel
  })
}

/** Stock at a project's 3 locations, taggable by location_type. */
export function useProjectStockLevels(projectId: number | null) {
  return useQuery({
    queryKey: inventoryKeys.stockByProject(projectId ?? 0),
    queryFn: () => fetchProjectStockLevels(projectId!),
    enabled: !!projectId,
    staleTime: 2 * 60 * 1000,
  })
}

export type ProjectReturnMovement = InventoryMovement & {
  item: { name: string } | null
  to_location: { name: string } | null
}

async function fetchProjectReturns(projectId: number): Promise<ProjectReturnMovement[]> {
  const { data: locations, error: locError } = await supabase
    .from('locations')
    .select('id')
    .eq('project_id', projectId)

  if (locError) throw locError

  const locationIds = (locations || []).map((l) => l.id)
  if (locationIds.length === 0) return []

  const { data, error } = await supabase
    .from('inventory_movements')
    .select('*, items(name), to_location:locations!inventory_movements_to_location_id_fkey(name)')
    .eq('movement_type', 'return')
    .in('from_location_id', locationIds)
    .order('created_at', { ascending: false })

  if (error) throw error
  return ((data || []) as unknown[]).map((row) => {
    const r = row as Record<string, unknown>
    return {
      ...r,
      item: r.items ?? null,
      to_location: r.to_location ?? null,
    } as ProjectReturnMovement
  })
}

/** Overstock return movements (movement_type='return') from a project's locations. */
export function useProjectReturns(projectId: number | null) {
  return useQuery({
    queryKey: inventoryKeys.returnsByProject(projectId ?? 0),
    queryFn: () => fetchProjectReturns(projectId!),
    enabled: !!projectId,
    staleTime: 60 * 1000,
  })
}
