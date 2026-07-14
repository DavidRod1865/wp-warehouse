/**
 * usePoMutations — Mutations for purchase order CRUD operations
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase'
import { poKeys } from './poKeys'
import type { PurchaseOrder, POFormData, POLineItem } from '../types'

/**
 * Create PO with line items
 */
export function useCreatePo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: POFormData & { pdf_storage_path?: string }) => {
      const pricingMode = data.pricing_mode ?? 'per_line'
      const lumpSum =
        pricingMode === 'lump_sum' ? data.lump_sum_amount ?? null : null

      // Insert the PO (vendor_id comes as number from form but needs to be sent to DB)
      const { data: po, error: poError } = await supabase
        .from('purchase_orders')
        .insert({
          po_number: data.po_number,
          vendor_id: Number(data.vendor_id),
          project_id: data.project_id,
          po_date: data.po_date,
          pdf_storage_path: data.pdf_storage_path || null,
          lump_sum_amount: lumpSum,
          notes: data.notes,
        })
        .select()
        .single()

      if (poError) {
        // Check for unique constraint violation on po_number
        if (poError.code === '23505') {
          throw new Error(`PO number "${data.po_number}" already exists`)
        }
        throw poError
      }

      // Insert line items — clear unit prices in lump-sum mode
      const { error: linesError } = await supabase
        .from('po_line_items')
        .insert(
          data.lines.map((line) => ({
            po_id: po.id,
            line_number: line.line_number,
            description: line.description,
            part_number: line.part_number,
            quantity_ordered: line.quantity_ordered,
            unit_price: pricingMode === 'lump_sum' ? null : line.unit_price,
            notes: line.notes,
          }))
        )

      if (linesError) throw linesError

      return po as PurchaseOrder
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: poKeys.lists() })
    },
  })
}

/**
 * Update PO header + line items
 */
export function useUpdatePo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      data,
      existingLines,
    }: {
      id: number
      data: POFormData
      existingLines: POLineItem[]
    }) => {
      const pricingMode = data.pricing_mode ?? 'per_line'
      const lumpSum =
        pricingMode === 'lump_sum' ? data.lump_sum_amount ?? null : null

      const { error: poError } = await supabase
        .from('purchase_orders')
        .update({
          po_number: data.po_number,
          vendor_id: Number(data.vendor_id),
          project_id: data.project_id,
          po_date: data.po_date,
          lump_sum_amount: lumpSum,
          notes: data.notes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)

      if (poError) {
        if (poError.code === '23505') {
          throw new Error(`PO number "${data.po_number}" already exists`)
        }
        throw poError
      }

      const keptIds = new Set(
        data.lines.flatMap((l) => (l.id != null ? [l.id] : []))
      )

      const toDelete = existingLines.filter((line) => !keptIds.has(line.id))
      for (const line of toDelete) {
        if (line.quantity_received > 0) {
          throw new Error(
            `Cannot remove line "${line.description}" — ${line.quantity_received} already received`
          )
        }
      }

      if (toDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('po_line_items')
          .delete()
          .in(
            'id',
            toDelete.map((l) => l.id)
          )
        if (deleteError) throw deleteError
      }

      for (let i = 0; i < data.lines.length; i++) {
        const line = data.lines[i]
        const lineNumber = i + 1
        const unitPrice = pricingMode === 'lump_sum' ? null : line.unit_price
        const existing = line.id
          ? existingLines.find((l) => l.id === line.id)
          : undefined

        if (existing && line.quantity_ordered < existing.quantity_received) {
          throw new Error(
            `Qty ordered on line ${lineNumber} cannot be below qty already received (${existing.quantity_received})`
          )
        }

        if (line.id) {
          const { error } = await supabase
            .from('po_line_items')
            .update({
              line_number: lineNumber,
              description: line.description,
              part_number: line.part_number,
              quantity_ordered: line.quantity_ordered,
              unit_price: unitPrice,
              notes: line.notes,
              updated_at: new Date().toISOString(),
            })
            .eq('id', line.id)
            .eq('po_id', id)
          if (error) throw error
        } else {
          const { error } = await supabase.from('po_line_items').insert({
            po_id: id,
            line_number: lineNumber,
            description: line.description,
            part_number: line.part_number,
            quantity_ordered: line.quantity_ordered,
            unit_price: unitPrice,
            notes: line.notes,
          })
          if (error) throw error
        }
      }
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: poKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: poKeys.lists() })
    },
  })
}

/**
 * Confirm PO (draft → confirmed)
 */
export function useConfirmPo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase
        .from('purchase_orders')
        .update({
          status: 'confirmed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: poKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: poKeys.lists() })
    },
  })
}

/**
 * Revert confirmed PO back to draft (blocked if any inventory received)
 */
export function useRevertPoToDraft() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      status,
      lineItems,
    }: {
      id: number
      status: string
      lineItems: Array<{ quantity_received: number }>
    }) => {
      if (status === 'draft') {
        throw new Error('Purchase order is already a draft')
      }
      if (status === 'cancelled') {
        throw new Error('Use Revert cancel to restore a cancelled PO')
      }
      if (status === 'received') {
        throw new Error('Fully received purchase orders cannot be reverted to draft')
      }
      if (lineItems.some((l) => l.quantity_received > 0)) {
        throw new Error(
          'Cannot revert to draft — inventory was already received against this PO'
        )
      }

      const { error } = await supabase
        .from('purchase_orders')
        .update({
          status: 'draft',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: poKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: poKeys.lists() })
    },
  })
}

/**
 * Cancel PO
 */
export function useCancelPo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase
        .from('purchase_orders')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: poKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: poKeys.lists() })
    },
  })
}

/**
 * Delete draft PO (cascades line items)
 */
export function useDeletePo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      status,
      pdf_storage_path,
    }: {
      id: number
      status: string
      pdf_storage_path?: string | null
    }) => {
      if (status !== 'draft') {
        throw new Error('Only draft purchase orders can be deleted')
      }

      const { error } = await supabase.from('purchase_orders').delete().eq('id', id)
      if (error) throw error

      if (pdf_storage_path) {
        await supabase.storage.from('purchase-orders').remove([pdf_storage_path])
      }
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: poKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: poKeys.lists() })
    },
  })
}

/**
 * Revert a cancelled PO to draft or confirmed.
 * Blocked when any line has quantity_received > 0.
 */
export function useRevertCancelledPo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      targetStatus,
      lineItems,
    }: {
      id: number
      targetStatus: 'draft' | 'confirmed'
      lineItems: Array<{ quantity_received: number }>
    }) => {
      const hasReceived = lineItems.some((l) => l.quantity_received > 0)
      if (hasReceived) {
        throw new Error(
          'Cannot revert — inventory was already received against this PO. Audit where those goods should go first.'
        )
      }

      const { data: po, error: fetchError } = await supabase
        .from('purchase_orders')
        .select('status')
        .eq('id', id)
        .single()

      if (fetchError) throw fetchError
      if (po.status !== 'cancelled') {
        throw new Error('Only cancelled purchase orders can be reverted')
      }

      const { error } = await supabase
        .from('purchase_orders')
        .update({
          status: targetStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: poKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: poKeys.lists() })
    },
  })
}

/**
 * Upload PDF to storage and return path
 */
export async function uploadPoFile(
  file: File,
  poNumber: string
): Promise<string> {
  // Create a unique path: po-number/timestamp-filename
  const timestamp = Date.now()
  const filename = `${timestamp}-${file.name}`
  const path = `${poNumber}/${filename}`

  const { error } = await supabase.storage
    .from('purchase-orders')
    .upload(path, file, { upsert: false })

  if (error) throw error
  return path
}

/**
 * Get signed URL for downloading PO PDF
 */
export async function getPoFileUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('purchase-orders')
    .createSignedUrl(path, 3600) // 1 hour expiry

  if (error) throw error
  return data.signedUrl
}
