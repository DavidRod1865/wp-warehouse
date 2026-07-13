/**
 * useCycleCounts — Fetch cycle counts with optional location filter
 * useCycleCountLines — Fetch lines for a specific cycle count
 */
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase'
import { auditKeys } from './auditKeys'

export interface CycleCount {
  id: number
  location_id: number
  status: 'draft' | 'finalized' | 'cancelled'
  counted_by: string | null
  notes: string | null
  created_at: string
  finalized_at: string | null
  // Joined
  location?: { id: number; name: string; location_type: string }
  counted_by_user?: { name: string } | null
}

export interface CycleCountLine {
  id: number
  cycle_count_id: number
  item_id: number
  quantity_system: number | null
  quantity_counted: number | null
  // Joined
  item?: { id: number; name: string; part_number: string | null }
}

async function fetchCycleCounts(locationId?: number): Promise<CycleCount[]> {
  let query = supabase
    .from('cycle_counts')
    .select(`
      id,
      location_id,
      status,
      counted_by,
      notes,
      created_at,
      finalized_at,
      location:locations(id, name, location_type)
    `)
    .order('created_at', { ascending: false })

  if (locationId) {
    query = query.eq('location_id', locationId)
  }

  const { data, error } = await query
  if (error) throw error
  return (data || []) as unknown as CycleCount[]
}

async function fetchCycleCountLines(cycleCountId: number): Promise<CycleCountLine[]> {
  const { data, error } = await supabase
    .from('cycle_count_lines')
    .select(`
      id,
      cycle_count_id,
      item_id,
      quantity_system,
      quantity_counted,
      item:items(id, name, part_number)
    `)
    .eq('cycle_count_id', cycleCountId)
    .order('id', { ascending: true })

  if (error) throw error
  return (data || []) as unknown as CycleCountLine[]
}

export function useCycleCounts(locationId?: number) {
  return useQuery({
    queryKey: locationId
      ? auditKeys.cycleCountsByLocation(locationId)
      : auditKeys.cycleCounts(),
    queryFn: () => fetchCycleCounts(locationId),
    staleTime: 30 * 1000,
  })
}

export function useCycleCountLines(cycleCountId: number | null) {
  return useQuery({
    queryKey: cycleCountId ? auditKeys.cycleCountLines(cycleCountId) : ['audit', 'none'],
    queryFn: () => fetchCycleCountLines(cycleCountId!),
    enabled: cycleCountId != null,
    staleTime: 15 * 1000,
  })
}
