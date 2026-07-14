/**
 * useStockLevels — Fetch stock levels with optional filtering
 *
 * Supports filtering by location or fetching all stock levels joined with items and locations.
 */
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase'
import { inventoryKeys } from './inventoryKeys'
import type { StockLevel } from '../types'

interface UseStockLevelsOptions {
  locationId?: number
}

async function fetchStockLevels(locationId?: number): Promise<StockLevel[]> {
  if (locationId) {
    // Join item data for name/part# display when filtering by location
    const { data, error } = await supabase
      .from('stock_levels')
      .select('*, item:items(id, name, part_number)')
      .eq('location_id', locationId)
      .order('updated_at', { ascending: false })

    if (error) throw error
    return (data || []) as unknown as StockLevel[]
  }

  const { data, error } = await supabase
    .from('stock_levels')
    .select('*')
    .order('updated_at', { ascending: false })

  if (error) throw error
  return (data || []) as StockLevel[]
}

export function useStockLevels(options?: UseStockLevelsOptions) {
  return useQuery({
    queryKey: options?.locationId
      ? inventoryKeys.stockByLocation(options.locationId)
      : inventoryKeys.stockLevels(),
    queryFn: () => fetchStockLevels(options?.locationId),
    staleTime: 2 * 60 * 1000,
  })
}

/**
 * useAllStockByItem — Fetch aggregated stock across all locations
 *
 * Groups stock levels by item and returns total quantity per item.
 */
async function fetchAllStockByItem(): Promise<Map<number, number>> {
  const { data, error } = await supabase
    .from('stock_levels')
    .select('item_id, quantity')

  if (error) throw error

  const map = new Map<number, number>()
  for (const record of data || []) {
    const current = map.get(record.item_id) || 0
    map.set(record.item_id, current + record.quantity)
  }

  return map
}

export function useAllStockByItem() {
  return useQuery({
    queryKey: inventoryKeys.allStockByItem(),
    queryFn: fetchAllStockByItem,
    staleTime: 2 * 60 * 1000,
  })
}
