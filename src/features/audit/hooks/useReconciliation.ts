/**
 * useReconciliation — Query the po_project_reconciliation view
 *
 * Fetches one row per po_line_item on non-cancelled POs.
 * Optional projectId filter narrows results to a single project.
 */
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase'
import { auditKeys } from './auditKeys'

export interface ReconciliationRow {
  project_id: number
  project_name: string
  po_id: number
  po_number: string
  vendor_name: string | null
  po_line_item_id: number
  line_number: number
  description: string
  part_number: string | null
  item_id: number | null
  quantity_ordered: number
  quantity_received: number
  received_status: string
  qty_delivered_to_site: number
  qty_on_hand_warehouse: number
  qty_on_truck: number
  reconciliation_state:
    | 'backorder'
    | 'complete'
    | 'in_warehouse'
    | 'in_transit'
    | 'over_delivered'
}

async function fetchReconciliation(projectId?: number): Promise<ReconciliationRow[]> {
  let query = supabase
    .from('po_project_reconciliation')
    .select('*')
    .order('po_number', { ascending: true })
    .order('line_number', { ascending: true })

  if (projectId) {
    query = query.eq('project_id', projectId)
  }

  const { data, error } = await query
  if (error) throw error
  return (data || []) as ReconciliationRow[]
}

export function useReconciliation(projectId?: number | null) {
  return useQuery({
    queryKey: projectId
      ? auditKeys.reconciliationByProject(projectId)
      : auditKeys.reconciliation(),
    queryFn: () => fetchReconciliation(projectId ?? undefined),
    staleTime: 60 * 1000, // 1 min — reconciliation data changes on PO/receiving events
  })
}
