/**
 * useReceipts — Fetch and manage receiving log entries
 *
 * Uses receiving_logs + receiving_log_entries + receiving_items tables.
 * receiving_logs groups entries by date/user; entries are the actual receipts;
 * receiving_items are the line items within each receipt.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase'
import { receivingKeys } from './receivingKeys'
import type { ReceivingEntry, ReceivingEntryWithItems, ReceivingItem } from '../types'

// ── List past receipts ────────────────────────────────

async function fetchPastReceipts(): Promise<ReceivingEntry[]> {
  const { data, error } = await supabase
    .from('receiving_log_entries')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) throw error
  return (data || []) as ReceivingEntry[]
}

export function usePastReceipts() {
  return useQuery({
    queryKey: receivingKeys.list(),
    queryFn: fetchPastReceipts,
    staleTime: 30 * 1000,
  })
}

// ── Receipt detail with line items ────────────────────

async function fetchReceiptDetail(entryId: number): Promise<ReceivingEntryWithItems> {
  const [entryRes, itemsRes] = await Promise.all([
    supabase
      .from('receiving_log_entries')
      .select('*')
      .eq('id', entryId)
      .single(),
    supabase
      .from('receiving_items')
      .select('*')
      .eq('receiving_entry_id', entryId)
      .order('id', { ascending: true }),
  ])

  if (entryRes.error) throw entryRes.error
  if (itemsRes.error) throw itemsRes.error

  return {
    ...(entryRes.data as ReceivingEntry),
    items: (itemsRes.data || []) as ReceivingItem[],
  }
}

export function useReceiptDetail(entryId: number | null) {
  return useQuery({
    queryKey: receivingKeys.detail(entryId!),
    queryFn: () => fetchReceiptDetail(entryId!),
    enabled: !!entryId,
    staleTime: 30 * 1000,
  })
}

// ── Line items for a receipt ──────────────────────────

async function fetchReceiptItems(entryId: number): Promise<ReceivingItem[]> {
  const { data, error } = await supabase
    .from('receiving_items')
    .select('*')
    .eq('receiving_entry_id', entryId)
    .order('id', { ascending: true })

  if (error) throw error
  return (data || []) as ReceivingItem[]
}

export function useReceiptItems(entryId: number | null) {
  return useQuery({
    queryKey: receivingKeys.items(entryId!),
    queryFn: () => fetchReceiptItems(entryId!),
    enabled: !!entryId,
    staleTime: 30 * 1000,
  })
}

// ── Quick create receipt (legacy simple form) ─────────

interface CreateReceiptInput {
  vendor: string
  po_number: string | null
  notes: string | null
  items_count: number
  received_by: string
}

export function useCreateReceipt() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateReceiptInput) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const today = new Date().toISOString().split('T')[0]

      let { data: log } = await supabase
        .from('receiving_logs')
        .select('id')
        .eq('log_date', today)
        .eq('created_by', user.id)
        .single()

      if (!log) {
        const { data: newLog, error: logErr } = await supabase
          .from('receiving_logs')
          .insert({ log_date: today, created_by: user.id, notes: null })
          .select('id')
          .single()
        if (logErr) throw logErr
        log = newLog
      }

      const { data: entry, error: entryErr } = await supabase
        .from('receiving_log_entries')
        .insert({
          receiving_log_id: log!.id,
          vendor: input.vendor,
          po_number: input.po_number,
          raw_content: input.notes,
          project_name: null,
          parsed_content: { items_count: input.items_count, received_by: input.received_by },
        })
        .select()
        .single()

      if (entryErr) throw entryErr
      return entry
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: receivingKeys.all })
    },
  })
}
