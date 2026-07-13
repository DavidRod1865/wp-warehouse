/**
 * useCycleCountMutations — Create, update lines, finalize cycle counts
 *
 * createCycleCount: inserts cycle_count row + seeds lines from current
 *   stock_levels at the chosen location (client-side inserts are fine since
 *   cycle count records are business records, not ledger writes).
 *
 * updateCountedQuantity: patches a single line's quantity_counted.
 *
 * finalizeCycleCount: calls the finalize_cycle_count RPC which adjusts stock
 *   and marks the count finalized in a single DB transaction.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase'
import { auditKeys } from './auditKeys'

// ── Create ───────────────────────────────────────────────────────────────────

interface CreateCycleCountInput {
  locationId: number
  notes?: string
}

async function createCycleCount(input: CreateCycleCountInput): Promise<number> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // 1. Insert the cycle count header
  const { data: countData, error: countError } = await supabase
    .from('cycle_counts')
    .insert({
      location_id: input.locationId,
      counted_by: user.id,
      notes: input.notes ?? null,
      status: 'draft',
    })
    .select('id')
    .single()

  if (countError) throw countError

  const cycleCountId = countData.id as number

  // 2. Seed lines from current stock_levels at the location
  const { data: stockRows, error: stockError } = await supabase
    .from('stock_levels')
    .select('item_id, quantity')
    .eq('location_id', input.locationId)
    .gt('quantity', 0)

  if (stockError) throw stockError

  if (stockRows && stockRows.length > 0) {
    const lines = stockRows.map((row) => ({
      cycle_count_id: cycleCountId,
      item_id: row.item_id,
      quantity_system: null, // captured at finalize time
      quantity_counted: null, // filled in by the counter
    }))

    const { error: linesError } = await supabase.from('cycle_count_lines').insert(lines)
    if (linesError) throw linesError
  }

  return cycleCountId
}

export function useCreateCycleCount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createCycleCount,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: auditKeys.cycleCounts() })
    },
  })
}

// ── Update a single line's counted quantity ───────────────────────────────────

interface UpdateLineInput {
  lineId: number
  cycleCountId: number
  quantityCounted: number
}

async function updateCountedQuantity(input: UpdateLineInput): Promise<void> {
  const { error } = await supabase
    .from('cycle_count_lines')
    .update({ quantity_counted: input.quantityCounted })
    .eq('id', input.lineId)

  if (error) throw error
}

export function useUpdateCountedQuantity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: updateCountedQuantity,
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: auditKeys.cycleCountLines(variables.cycleCountId) })
    },
  })
}

// ── Finalize ─────────────────────────────────────────────────────────────────

interface FinalizeResult {
  success: boolean
  cycle_count_id: number
  lines_adjusted: number
  lines_unchanged: number
}

async function finalizeCycleCount(cycleCountId: number): Promise<FinalizeResult> {
  const { data, error } = await supabase.rpc('finalize_cycle_count', {
    p_cycle_count_id: cycleCountId,
  })

  if (error) throw error
  return data as FinalizeResult
}

export function useFinalizeCycleCount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: finalizeCycleCount,
    onSuccess: (_data, cycleCountId) => {
      qc.invalidateQueries({ queryKey: auditKeys.cycleCounts() })
      qc.invalidateQueries({ queryKey: auditKeys.cycleCountLines(cycleCountId) })
      // Invalidate inventory stock too — finalize adjusts stock_levels
      qc.invalidateQueries({ queryKey: ['inventory', 'stock_levels'] })
      qc.invalidateQueries({ queryKey: ['inventory', 'movements'] })
    },
  })
}

// ── Cancel ───────────────────────────────────────────────────────────────────

async function cancelCycleCount(cycleCountId: number): Promise<void> {
  const { error } = await supabase
    .from('cycle_counts')
    .update({ status: 'cancelled' })
    .eq('id', cycleCountId)
    .eq('status', 'draft') // guard: only cancel drafts

  if (error) throw error
}

export function useCancelCycleCount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: cancelCycleCount,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: auditKeys.cycleCounts() })
    },
  })
}
