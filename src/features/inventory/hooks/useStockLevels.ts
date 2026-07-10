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
  let query = supabase.from('stock_levels').select('*')

  if (locationId) {
    query = query.eq('location_id', locationId)
  }

  query = query.order('updated_at', { ascending: false })

  const { data, error } = await query

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
