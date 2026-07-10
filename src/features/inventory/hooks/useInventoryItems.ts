/**
 * useInventoryItems — Fetch inventory items with optional search
 *
 * Supports searching by name or part_number.
 */
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase'
import { inventoryKeys } from './inventoryKeys'
import type { InventoryItem } from '../types'

interface UseInventoryItemsOptions {
  search?: string
}

async function fetchInventoryItems(search?: string): Promise<InventoryItem[]> {
  let query = supabase.from('items').select('*')

  if (search && search.length >= 2) {
    const searchLower = search.toLowerCase()
    query = query.or(`name.ilike.%${searchLower}%,part_number.ilike.%${searchLower}%`)
  }

  query = query.order('name', { ascending: true })

  const { data, error } = await query

  if (error) throw error
  return data || []
}

export function useInventoryItems(options?: UseInventoryItemsOptions) {
  const search = options?.search

  return useQuery({
    queryKey: search ? inventoryKeys.itemSearch(search) : inventoryKeys.items(),
    queryFn: () => fetchInventoryItems(search),
    staleTime: 3 * 60 * 1000,
    enabled: !search || search.length >= 2,
  })
}

export function useInventoryItem(id: number | null | undefined) {
  return useQuery({
    queryKey: inventoryKeys.itemDetail(id!),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('id', id!)
        .single()

      if (error) throw error
      return data as InventoryItem
    },
    enabled: !!id,
    staleTime: 3 * 60 * 1000,
  })
}
