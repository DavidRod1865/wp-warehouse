/**
 * useDeliveryMutations — Create, update, cancel and confirm delivery mutations
 *
 * Phase 5+: All operations go through Supabase RPCs (create_delivery,
 * update_delivery_items, cancel_delivery, confirm_delivery). No Sortly.
 *
 * Invalidates both delivery and inventory (stock/movements) query caches.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase'
import { deliveryKeys } from './deliveryKeys'
import { inventoryKeys } from '../../inventory/hooks/inventoryKeys'
import type { DeliveryFormValues, DeliveryItemFormValues } from '../schemas/deliverySchema'
import type { ActivityLogEntry } from '../types'

// ── Create Delivery ──────────────────────────────────────────

interface CreateDeliveryParams {
  formValues: DeliveryFormValues
  userId: string
  userEmail: string
  userName?: string
}

export function useCreateDelivery() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ formValues }: CreateDeliveryParams) => {
      const {
        po_reference,
        project_id,
        truck_location_id,
        from_location_id,
        from_address,
        to_address,
        items,
        driver_id,
        status,
      } = formValues

      if (!truck_location_id || !from_location_id) {
        throw new Error('Truck and source location are required')
      }

      const payload = {
        project_id,
        driver_id: driver_id || null,
        truck_location_id,
        from_location_id,
        status: status || 'draft',
        from_address,
        to_address,
        po_reference: po_reference || null,
        items: items.map((item) => ({
          item_id: item.item_id ?? null,
          item_name: item.item_name,
          quantity: item.quantity,
          notes: item.notes || null,
        })),
      }

      const { data, error } = await supabase.rpc('create_delivery', { p: payload })
      if (error) throw error

      const result = data as { success: boolean; delivery_id: number; delivery_number: string }
      if (!result?.success) throw new Error('create_delivery RPC returned unsuccessful')

      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: deliveryKeys.all })
      queryClient.invalidateQueries({ queryKey: inventoryKeys.stockLevels() })
      queryClient.invalidateQueries({ queryKey: inventoryKeys.movements() })
    },
  })
}

// ── Update Delivery (header fields only — items via separate RPC) ───────────

interface UpdateDeliveryParams {
  deliveryId: number
  formValues: DeliveryFormValues
  previousItems: Array<{ item_id?: number | null; quantity: number }>
  activityLog: ActivityLogEntry[]
  userId: string
  userEmail: string
  userName?: string
}

export function useUpdateDelivery() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      deliveryId,
      formValues,
      activityLog,
      userId,
      userEmail,
      userName,
    }: UpdateDeliveryParams) => {
      const {
        po_reference,
        project_id,
        truck_location_id,
        from_location_id,
        from_address,
        to_address,
        items,
        driver_id,
        status,
      } = formValues

      // 1. Update header fields on the delivery row
      const updatedLog: ActivityLogEntry[] = [
        ...activityLog,
        {
          timestamp: new Date().toISOString(),
          action: 'edited',
          user_id: userId,
          user_email: userEmail,
          user_name: userName,
          details: { items_count: items.length },
        },
      ]

      const { error: updateError } = await supabase
        .from('deliveries')
        .update({
          po_reference: po_reference || null,
          project_id,
          driver_id: driver_id || null,
          status,
          from_address,
          to_address,
          truck_location_id: truck_location_id || null,
          from_location_ref: from_location_id || null,
          activity_log: updatedLog,
        })
        .eq('id', deliveryId)

      if (updateError) throw updateError

      // 2. Reconcile item changes via RPC (handles stock movements atomically)
      const itemsPayload = items.map((item) => ({
        item_id: item.item_id ?? null,
        item_name: item.item_name,
        quantity: item.quantity,
        delivered_quantity: item.delivered_quantity || 0,
        remaining_quantity: item.remaining_quantity || item.quantity,
        notes: item.notes || null,
      }))

      const { data: updateResult, error: itemsError } = await supabase.rpc(
        'update_delivery_items',
        { p_delivery_id: deliveryId, p_items: itemsPayload }
      )
      if (itemsError) throw itemsError

      return { id: deliveryId, ...(updateResult as object) }
    },
    onSuccess: (_data, params) => {
      queryClient.invalidateQueries({ queryKey: deliveryKeys.all })
      queryClient.invalidateQueries({ queryKey: deliveryKeys.detail(params.deliveryId) })
      queryClient.invalidateQueries({ queryKey: deliveryKeys.items(params.deliveryId) })
      queryClient.invalidateQueries({ queryKey: inventoryKeys.stockLevels() })
      queryClient.invalidateQueries({ queryKey: inventoryKeys.movements() })
    },
  })
}

// ── Cancel Delivery ──────────────────────────────────────────

interface CancelDeliveryParams {
  deliveryId: number
  userId?: string
  userEmail?: string
  userName?: string
}

export function useCancelDelivery() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ deliveryId }: CancelDeliveryParams) => {
      const { data, error } = await supabase.rpc('cancel_delivery', {
        p_delivery_id: deliveryId,
      })
      if (error) throw error

      const result = data as { success: boolean; delivery_id: number; status: string }
      if (!result?.success) throw new Error('cancel_delivery RPC returned unsuccessful')

      return result
    },
    onSuccess: (_data, params) => {
      queryClient.invalidateQueries({ queryKey: deliveryKeys.all })
      queryClient.invalidateQueries({ queryKey: deliveryKeys.detail(params.deliveryId) })
      queryClient.invalidateQueries({ queryKey: inventoryKeys.stockLevels() })
      queryClient.invalidateQueries({ queryKey: inventoryKeys.movements() })
    },
  })
}

// ── Confirm Delivery (Driver) ────────────────────────────────

interface ConfirmDeliveryParams {
  deliveryId: number
  driverId: string
  signedByName: string
  signatureBlob?: Blob
  notes?: string
  deliveredItems?: Array<{ delivery_item_id: number; delivered_quantity: number }>
}

export function useConfirmDelivery() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      deliveryId,
      driverId,
      signedByName,
      signatureBlob,
      notes,
      deliveredItems,
    }: ConfirmDeliveryParams) => {
      let signatureStoragePath: string | null = null

      // Upload signature to private bucket delivery-signatures-v2
      if (signatureBlob) {
        const filePath = `${deliveryId}/${driverId}/${Date.now()}.png`
        const { error: uploadError } = await supabase.storage
          .from('delivery-signatures-v2')
          .upload(filePath, signatureBlob, {
            contentType: 'image/png',
            upsert: true,
          })

        if (uploadError) throw uploadError
        signatureStoragePath = filePath
      }

      // Call confirm_delivery RPC
      const { data, error } = await supabase.rpc('confirm_delivery', {
        p_delivery_id:             deliveryId,
        p_signed_by_name:          signedByName,
        p_signature_storage_path:  signatureStoragePath,
        p_notes:                   notes || null,
        p_delivered:               deliveredItems
          ? JSON.stringify(deliveredItems)
          : null,
      })

      if (error) throw error

      const result = data as { success: boolean; delivery_id: number; items_moved: number }
      if (!result?.success) throw new Error('confirm_delivery RPC returned unsuccessful')

      return result
    },
    onSuccess: (_data, params) => {
      queryClient.invalidateQueries({ queryKey: deliveryKeys.all })
      queryClient.invalidateQueries({ queryKey: deliveryKeys.detail(params.deliveryId) })
      queryClient.invalidateQueries({ queryKey: inventoryKeys.stockLevels() })
      queryClient.invalidateQueries({ queryKey: inventoryKeys.movements() })
    },
  })
}

// ── Legacy alias kept to avoid breaking DashboardPage / DeliveriesPage ───────
// The cancel RPC reads the delivery row itself. We proxy to useCancelDelivery.

interface DeleteDeliveryParams {
  deliveryId: number
  deliveryNumber?: string
  status?: string
  fromLocationId?: number | null
  activityLog?: ActivityLogEntry[]
  deliveryItems?: Array<{ item_name: string; quantity: number }>
  userId?: string
  userEmail?: string
  userName?: string
}

export function useDeleteDelivery() {
  const inner = useCancelDelivery()

  return {
    ...inner,
    mutateAsync: async (opts: DeleteDeliveryParams) => {
      return inner.mutateAsync({
        deliveryId: opts.deliveryId,
        userId: opts.userId,
        userEmail: opts.userEmail,
        userName: opts.userName,
      })
    },
    mutate: (opts: DeleteDeliveryParams, callbacks?: Parameters<typeof inner.mutate>[1]) => {
      inner.mutate({
        deliveryId: opts.deliveryId,
        userId: opts.userId,
        userEmail: opts.userEmail,
        userName: opts.userName,
      }, callbacks)
    },
  }
}

// Re-export item form values type for convenience
export type { DeliveryItemFormValues }
