/**
 * usePoMutations — Mutations for purchase order CRUD operations
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase'
import { poKeys } from './poKeys'
import type { PurchaseOrder, POFormData } from '../types'

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
 * Update PO (metadata only, not line items)
 */
export function useUpdatePo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number
      data: Partial<Omit<POFormData, 'lines'>>
    }) => {
      const { error } = await supabase
        .from('purchase_orders')
        .update({
          ...(data.po_number && { po_number: data.po_number }),
          ...(data.po_date && { po_date: data.po_date }),
          ...(data.notes !== undefined && { notes: data.notes }),
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
