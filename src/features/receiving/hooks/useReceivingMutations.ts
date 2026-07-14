/**
 * useReceivingMutations — Core mutation for confirming receipts (Phase 4)
 *
 * Flow:
 * 1. Create / fetch today's receiving_log (Supabase insert, fine as-is).
 * 2. Insert a receiving_log_entry row (draft; status = 'draft').
 * 3. Build the p_items array and call confirm_receipt RPC, which atomically:
 *    - Creates missing items in `items`.
 *    - Upserts stock at the destination location.
 *    - Appends inventory_movements ledger rows.
 *    - Inserts receiving_items rows.
 *    - Accumulates PO line quantity_received + recomputes received_status + PO status.
 *    - Sets the entry status to 'confirmed'.
 * 4. Invalidate: receivingKeys, poKeys, inventoryKeys (stock, items, movements).
 *
 * Nothing in this file imports Sortly code.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase'
import { receivingKeys } from './receivingKeys'
import { poKeys } from '../../purchase-orders/hooks/poKeys'
import { inventoryKeys } from '../../inventory/hooks/inventoryKeys'
import type {
  ConfirmReceiptParams,
  ConfirmReceiptItemPayload,
  ReceivingLineItem,
} from '../types'

interface ConfirmResult {
  entryId: number
  itemsProcessed: number
  poId: number | null
  poStatus: string | null
}

/** Build the RPC payload item from a UI line item */
function buildItemPayload(
  item: ReceivingLineItem,
  defaultLocationId: number,
): ConfirmReceiptItemPayload {
  const locationId = item.destination_location_id ?? defaultLocationId

  return {
    po_line_item_id: item.po_line_item_id ?? null,
    item_id: item.item_id ?? null,
    // If item_id is null, pass new_item so the RPC can create it
    new_item:
      item.item_id == null
        ? { name: item.item_name, part_number: item.part_number ?? null }
        : null,
    item_name: item.item_name,
    part_number: item.part_number ?? null,
    quantity_received: item.quantity_received,
    destination_location_id: locationId,
    notes: item.notes ?? null,
  }
}

export function useConfirmReceipt(onProgress?: (message: string) => void) {
  const queryClient = useQueryClient()

  return useMutation<ConfirmResult, Error, ConfirmReceiptParams>({
    mutationFn: async (params) => {
      const {
        vendor,
        vendor_id,
        po_id,
        po_number,
        date_received,
        destination_type,
        destination_location_id,
        project_name,
        project_id,
        notes,
        items,
      } = params

      // Only process items that are not skipped and have an action
      const activeItems = items.filter((i) => i.action !== 'skip' && i.action !== 'pending')

      if (activeItems.length === 0) {
        throw new Error('No items to receive — make sure each item is linked or set to "Create new".')
      }

      if (destination_location_id == null) {
        throw new Error('A destination location is required.')
      }

      onProgress?.('Saving receipt header...')

      // Step 1: Get or create today's receiving_log
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const today = new Date().toISOString().split('T')[0]

      let { data: log } = await supabase
        .from('receiving_logs')
        .select('id')
        .eq('log_date', today)
        .eq('created_by', user.id)
        .maybeSingle()

      if (!log) {
        const { data: newLog, error: logErr } = await supabase
          .from('receiving_logs')
          .insert({ log_date: today, created_by: user.id, notes: null })
          .select('id')
          .single()
        if (logErr) throw logErr
        log = newLog
      }

      // Step 2: Insert receiving_log_entry as draft (RPC will confirm it)
      const { data: entry, error: entryErr } = await supabase
        .from('receiving_log_entries')
        .insert({
          receiving_log_id: log!.id,
          vendor,
          vendor_id: vendor_id ?? null,
          po_id: po_id ?? null,
          po_number: po_number || null,
          project_name: project_name ?? null,
          project_id: project_id ?? null,
          raw_content: notes ?? null,
          status: 'draft',
          destination_type,
          destination_location_id,
          date_received,
          parsed_content: {
            items_count: items.length,
            active_items: activeItems.length,
            received_by: user.email,
          },
        })
        .select('id')
        .single()

      if (entryErr) throw entryErr

      // Step 3: Build RPC payload and call confirm_receipt
      onProgress?.('Updating inventory and purchase order...')

      const rpcItems: ConfirmReceiptItemPayload[] = activeItems.map((item) =>
        buildItemPayload(item, destination_location_id)
      )

      const { data: rpcResult, error: rpcErr } = await supabase.rpc('confirm_receipt', {
        p_entry_id: entry!.id,
        p_items: rpcItems,
        p_notes: notes ?? null,
      })

      if (rpcErr) throw rpcErr

      const result = rpcResult as {
        success: boolean
        entry_id: number
        items_processed: number
        po_id: number | null
        po_status: string | null
      }

      if (!result.success) {
        throw new Error('confirm_receipt RPC returned success=false')
      }

      return {
        entryId: result.entry_id,
        itemsProcessed: result.items_processed,
        poId: result.po_id ?? null,
        poStatus: result.po_status ?? null,
      }
    },

    onSuccess: () => {
      // Invalidate receiving (daily log + list)
      queryClient.invalidateQueries({ queryKey: receivingKeys.all })
      // Invalidate PO list/details (status may have changed)
      queryClient.invalidateQueries({ queryKey: poKeys.all() })
      // Invalidate inventory stock levels, items list, movements
      queryClient.invalidateQueries({ queryKey: inventoryKeys.stockLevels() })
      queryClient.invalidateQueries({ queryKey: inventoryKeys.items() })
      queryClient.invalidateQueries({ queryKey: inventoryKeys.movements() })
    },
  })
}
