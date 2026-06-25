/**
 * useReceivedDates — Fetch receiving log entries for a project.
 *
 * Correlates receiving_log_entries to Sortly items by matching
 * vendor (Brand) + po_number (PO Number) custom attributes.
 * Returns a Map keyed by "vendor|po" for fast lookup per item row.
 */
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase'

interface ReceivedEntry {
  vendor: string
  po_number: string | null
  created_at: string
}

async function fetchReceivedDates(projectName: string): Promise<ReceivedEntry[]> {
  const { data, error } = await supabase
    .from('receiving_log_entries')
    .select('vendor, po_number, created_at')
    .eq('project_name', projectName)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data || []) as ReceivedEntry[]
}

function buildKey(vendor: string, po: string | null): string {
  return `${(vendor || '').toLowerCase()}|${(po || '').toLowerCase()}`
}

/**
 * Look up the most recent received date for items in a project.
 * Match by vendor (Brand) + PO Number custom attributes.
 */
export function useReceivedDates(projectName: string | null) {
  const query = useQuery({
    queryKey: ['receivedDates', projectName],
    queryFn: () => fetchReceivedDates(projectName!),
    enabled: !!projectName,
    staleTime: 2 * 60 * 1000,
  })

  // Build lookup map: "vendor|po" → earliest received date
  const dateMap = new Map<string, string>()
  if (query.data) {
    // Data is ordered desc, so last write wins = earliest date
    for (const entry of query.data) {
      const key = buildKey(entry.vendor, entry.po_number)
      dateMap.set(key, entry.created_at)
    }
  }

  return {
    ...query,
    dateMap,
    /** Get received date for a Sortly item by its Brand + PO Number attributes. */
    getReceivedDate(brand: string, poNumber: string | null): string | null {
      const key = buildKey(brand, poNumber)
      return dateMap.get(key) ?? null
    },
  }
}
