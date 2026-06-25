/**
 * useReceivingMutations — Core mutation for confirming receipts
 *
 * Handles the full confirm flow:
 * 1. Update Sortly quantities for matched items
 * 2. Create new Sortly items for unmatched items
 * 3. Save receipt header + line items to Supabase
 * 4. Invalidate caches
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase'
import { sortlyClient } from '../../../lib/sortly'
import { receivingKeys } from './receivingKeys'
import { sortlyKeys } from '../../inventory/hooks/sortlyKeys'
import type { ConfirmReceiptParams, ReceivingLineItem } from '../types'

type CustomAttr = {
  custom_attribute_id: number
  custom_attribute_name: string
  value: string
}

/** Fetch custom field definitions from Sortly (cached per call) */
let cachedFieldMap: Map<string, number> | null = null

async function getCustomFieldMap(): Promise<Map<string, number>> {
  if (cachedFieldMap) return cachedFieldMap

  const result = await sortlyClient.listCustomFields()
  const map = new Map<string, number>()
  for (const field of result.data) {
    map.set(field.name.toLowerCase(), field.id)
  }
  cachedFieldMap = map
  return map
}

function buildCustomAttributes(
  fieldMap: Map<string, number>,
  vendor: string | null,
  partNumber: string | null,
  poNumber: string | null,
): CustomAttr[] {
  const attrs: CustomAttr[] = []

  if (vendor) {
    const id = fieldMap.get('brand')
    if (id) attrs.push({ custom_attribute_id: id, custom_attribute_name: 'Brand', value: vendor })
  }
  if (partNumber) {
    const id = fieldMap.get('part number')
    if (id) attrs.push({ custom_attribute_id: id, custom_attribute_name: 'Part Number', value: partNumber })
  }
  if (poNumber) {
    const id = fieldMap.get('po number')
    if (id) attrs.push({ custom_attribute_id: id, custom_attribute_name: 'PO Number', value: poNumber })
  }

  return attrs
}

interface ConfirmResult {
  entryId: number
  itemsUpdated: number
  itemsCreated: number
  itemsSkipped: number
}

export function useConfirmReceipt(onProgress?: (message: string) => void) {
  const queryClient = useQueryClient()

  return useMutation<ConfirmResult, Error, ConfirmReceiptParams>({
    mutationFn: async (params) => {
      const {
        vendor,
        po_number,
        date_received,
        destination_type,
        destination_folder_id,
        project_name,
        project_id,
        notes,
        items,
      } = params

      let itemsUpdated = 0
      let itemsCreated = 0
      let itemsSkipped = 0

      // Pre-fetch custom fields for creating new items
      const fieldMap = await getCustomFieldMap()

      // Track results per item for Supabase insert
      const processedItems: Array<ReceivingLineItem & {
        sortly_quantity_before: number | null
        sortly_quantity_after: number | null
        final_sortly_item_id: number | null
      }> = []

      // Step 1: Process Sortly operations sequentially
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        onProgress?.(`Processing item ${i + 1} of ${items.length}: ${item.item_name}`)

        let qtyBefore: number | null = null
        let qtyAfter: number | null = null
        let finalSortlyId: number | null = item.sortly_item_id

        const sortlyTags = item.tags.length > 0
          ? item.tags.map((name) => ({ name }))
          : undefined

        if (item.action === 'update' && item.sortly_item_id) {
          // Read current quantity and increment
          const current = await sortlyClient.getItem(item.sortly_item_id)
          qtyBefore = Math.round(current.data.quantity ?? 0)
          qtyAfter = qtyBefore + item.quantity_received

          await sortlyClient.updateItem(item.sortly_item_id, {
            quantity: qtyAfter,
            ...(sortlyTags ? { tags: sortlyTags } : {}),
          })
          itemsUpdated++
        } else if (item.action === 'create') {
          // Create new item in Sortly
          const folderId = item.destination_folder_id || destination_folder_id
          const attrs = buildCustomAttributes(fieldMap, vendor, item.part_number, po_number)

          const result = await sortlyClient.createItem({
            name: item.item_name,
            type: 'item',
            parent_id: folderId,
            quantity: item.quantity_received,
            custom_attribute_values: attrs,
            ...(sortlyTags ? { tags: sortlyTags } : {}),
          })

          finalSortlyId = result.data.id
          qtyBefore = 0
          qtyAfter = item.quantity_received
          itemsCreated++
        } else {
          itemsSkipped++
        }

        processedItems.push({
          ...item,
          sortly_quantity_before: qtyBefore,
          sortly_quantity_after: qtyAfter,
          final_sortly_item_id: finalSortlyId,
        })
      }

      // Step 2: Save to Supabase
      onProgress?.('Saving receipt to database...')

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const today = new Date().toISOString().split('T')[0]

      // Get or create today's receiving_log
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

      // Compute unique destination names for receipt-level summary
      const uniqueDestinations = [...new Set(
        processedItems
          .filter((i) => i.action !== 'skip')
          .map((i) => i.destination_folder_name || project_name)
          .filter(Boolean)
      )]

      // Insert receiving_log_entry
      const { data: entry, error: entryErr } = await supabase
        .from('receiving_log_entries')
        .insert({
          receiving_log_id: log!.id,
          vendor,
          po_number,
          project_name,
          project_id,
          raw_content: notes,
          status: 'confirmed',
          destination_type,
          destination_folder_id,
          date_received,
          parsed_content: {
            items_count: items.length,
            items_updated: itemsUpdated,
            items_created: itemsCreated,
            items_skipped: itemsSkipped,
            received_by: user.email,
            unique_destinations: uniqueDestinations,
          },
        })
        .select('id')
        .single()

      if (entryErr) throw entryErr

      // Insert receiving_items
      const itemRows = processedItems.map((item) => ({
        receiving_entry_id: entry!.id,
        sortly_item_id: item.final_sortly_item_id,
        item_name: item.item_name,
        part_number: item.part_number,
        quantity_received: item.quantity_received,
        action: item.action,
        sortly_quantity_before: item.sortly_quantity_before,
        sortly_quantity_after: item.sortly_quantity_after,
        destination_folder_id: item.destination_folder_id || destination_folder_id,
        destination_folder_name: item.destination_folder_name || project_name,
        notes: item.notes,
      }))

      const { error: itemsErr } = await supabase
        .from('receiving_items')
        .insert(itemRows)

      if (itemsErr) throw itemsErr

      return {
        entryId: entry!.id,
        itemsUpdated,
        itemsCreated,
        itemsSkipped,
      }
    },
    onSuccess: () => {
      // Clear the custom field cache for next session
      cachedFieldMap = null

      // Invalidate receiving and Sortly caches
      queryClient.invalidateQueries({ queryKey: receivingKeys.all })
      queryClient.invalidateQueries({ queryKey: sortlyKeys.items() })
    },
  })
}
