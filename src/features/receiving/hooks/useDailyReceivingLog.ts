/**
 * useDailyReceivingLog — Fetch all receiving entries for a given date
 *
 * Joins receiving_log_entries (filtered by date_received OR created_at falling
 * on the date) with their receiving_items in a single trip.
 */
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase'
import { receivingKeys } from './receivingKeys'
import type {
  DailyReceivingLog,
  ReceivingEntry,
  ReceivingEntryWithItems,
  ReceivingItem,
} from '../types'

async function fetchDailyLog(date: string): Promise<DailyReceivingLog> {
  // Fetch entries received on this date.
  // Prefer `date_received` (user-specified); fall back to `created_at` for
  // legacy rows where date_received is null.
  const dayStart = `${date}T00:00:00`
  const dayEnd = `${date}T23:59:59.999`

  const { data: entries, error: entriesErr } = await supabase
    .from('receiving_log_entries')
    .select('*')
    .or(`date_received.eq.${date},and(date_received.is.null,created_at.gte.${dayStart},created_at.lte.${dayEnd})`)
    .order('created_at', { ascending: true })

  if (entriesErr) throw entriesErr

  const entryRows = (entries || []) as ReceivingEntry[]

  if (entryRows.length === 0) {
    return { date, entries: [] }
  }

  // Fetch all line items for these entries in one query
  const entryIds = entryRows.map((e) => e.id)
  const { data: items, error: itemsErr } = await supabase
    .from('receiving_items')
    .select('*')
    .in('receiving_entry_id', entryIds)
    .order('id', { ascending: true })

  if (itemsErr) throw itemsErr

  // Group items by entry id
  const itemsByEntry = new Map<number, ReceivingItem[]>()
  for (const item of (items || []) as ReceivingItem[]) {
    const list = itemsByEntry.get(item.receiving_entry_id) ?? []
    list.push(item)
    itemsByEntry.set(item.receiving_entry_id, list)
  }

  const enriched: ReceivingEntryWithItems[] = entryRows.map((e) => ({
    ...e,
    items: itemsByEntry.get(e.id) ?? [],
  }))

  return { date, entries: enriched }
}

export function useDailyReceivingLog(date: string | null) {
  return useQuery({
    queryKey: receivingKeys.daily(date ?? ''),
    queryFn: () => fetchDailyLog(date!),
    enabled: !!date,
    staleTime: 30 * 1000,
  })
}

/** List of distinct dates that have at least one entry — for date navigation */
async function fetchDatesWithEntries(): Promise<string[]> {
  const { data, error } = await supabase
    .from('receiving_log_entries')
    .select('date_received, created_at')
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) throw error

  const dates = new Set<string>()
  for (const row of data || []) {
    const d = (row as { date_received: string | null; created_at: string }).date_received
      ?? (row as { created_at: string }).created_at.split('T')[0]
    if (d) dates.add(d)
  }
  return Array.from(dates).sort().reverse()
}

export function useDatesWithEntries() {
  return useQuery({
    queryKey: receivingKeys.dates(),
    queryFn: fetchDatesWithEntries,
    staleTime: 60 * 1000,
  })
}
