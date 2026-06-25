/**
 * useDeliveryMutations — Create, update, and delete delivery mutations
 *
 * Each mutation handles:
 * 1. Sortly operations (copy/move items between folders)
 * 2. Supabase database writes
 * 3. Cache invalidation (both delivery and Sortly queries)
 *
 * The old codebase had these spread across DeliveryForm.tsx (2163 lines)
 * and deliveryDelete.ts. Now they're self-contained mutation hooks.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase'
import { sortlyClient } from '../../../lib/sortly'
import { deliveryKeys } from './deliveryKeys'
import { sortlyKeys } from '../../inventory/hooks/sortlyKeys'
import type { DeliveryFormValues, DeliveryItem, ActivityLogEntry } from '../types'

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
    mutationFn: async ({ formValues, userId, userEmail, userName }: CreateDeliveryParams) => {
      const {
        delivery_number,
        po_reference,
        project_id,
        truck_folder_id,
        from_location_id,
        from_address,
        to_address,
        items,
        driver_id,
        status,
      } = formValues

      if (!truck_folder_id || !from_location_id) {
        throw new Error('Truck and source location are required')
      }

      // Step 1: Copy items from warehouse → truck in Sortly
      const copiedItemIds: number[] = []

      for (const item of items) {
        if (item.sortly_item_id && !item.is_manual) {
          try {
            const result = await sortlyClient.copyItem(
              item.sortly_item_id,
              item.quantity,
              truck_folder_id
            )
            copiedItemIds.push(result.data.id)

            // Tag copied item with delivery note
            await sortlyClient.addDeliveryNote(result.data.id, delivery_number)
          } catch (err) {
            console.error(`Failed to copy item ${item.item_name}:`, err)
            throw new Error(`Failed to copy "${item.item_name}" to truck. ${err instanceof Error ? err.message : ''}`)
          }
        }
      }

      // Step 2: Insert delivery record
      const activityLog: ActivityLogEntry[] = [{
        timestamp: new Date().toISOString(),
        action: 'created',
        user_id: userId,
        user_email: userEmail,
        user_name: userName,
        details: {
          items_count: items.length,
          delivery_type: project_id ? 'commercial' : 'residential',
          project_name: project_id ? 'linked' : null,
          truck_name: formValues.truck_folder_id?.toString(),
        },
      }]

      const { data: delivery, error: deliveryError } = await supabase
        .from('deliveries')
        .insert({
          delivery_number,
          po_reference: po_reference || null,
          project_id,
          driver_id,
          status,
          from_address,
          to_address,
          from_location_id,
          truck_sortly_folder_id: truck_folder_id,
          from_location_type: 'warehouse',
          delivery_type: project_id ? 'commercial' : 'residential',
          activity_log: activityLog,
          created_by: userId,
        })
        .select()
        .single()

      if (deliveryError) throw deliveryError

      // Step 3: Insert delivery items
      const deliveryItemsToInsert = items.map((item) => ({
        delivery_id: delivery.id,
        sortly_item_id: item.sortly_item_id,
        item_name: item.item_name,
        quantity: item.quantity,
        delivered_quantity: 0,
        remaining_quantity: item.quantity,
        notes: item.location || null,
        custom_attribute_values: item.custom_attribute_values || null,
      }))

      const { error: itemsError } = await supabase
        .from('delivery_items')
        .insert(deliveryItemsToInsert)
        .select()

      if (itemsError) throw itemsError

      return delivery
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: deliveryKeys.all })
      queryClient.invalidateQueries({ queryKey: sortlyKeys.items() })
    },
  })
}

// ── Update Delivery ──────────────────────────────────────────

interface UpdateDeliveryParams {
  deliveryId: number
  formValues: DeliveryFormValues
  previousItems: DeliveryItem[]
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
      previousItems,
      activityLog,
      userId,
      userEmail,
      userName,
    }: UpdateDeliveryParams) => {
      const {
        po_reference,
        project_id,
        truck_folder_id,
        from_location_id,
        from_address,
        to_address,
        items,
        driver_id,
        status,
      } = formValues

      // Step 1: Handle Sortly operations for item changes
      // (New items need to be copied, removed items need cleanup)
      const previousItemKeys = new Set(
        previousItems.map((i) =>
          i.sortly_item_id ? `sortly:${i.sortly_item_id}` : `manual:${i.item_name}`
        )
      )

      const newItems = items.filter((item) => {
        const key = item.sortly_item_id
          ? `sortly:${item.sortly_item_id}`
          : `manual:${item.item_name}`
        return !previousItemKeys.has(key)
      })

      // Copy new Sortly items to truck
      if (truck_folder_id) {
        for (const item of newItems) {
          if (item.sortly_item_id && !item.is_manual) {
            try {
              const result = await sortlyClient.copyItem(
                item.sortly_item_id,
                item.quantity,
                truck_folder_id
              )
              await sortlyClient.addDeliveryNote(
                result.data.id,
                formValues.delivery_number
              )
            } catch (err) {
              console.error(`Failed to copy new item ${item.item_name}:`, err)
              throw new Error(`Failed to copy "${item.item_name}" to truck`)
            }
          }
        }
      }

      // Step 2: Build activity log entry
      const updatedLog: ActivityLogEntry[] = [
        ...activityLog,
        {
          timestamp: new Date().toISOString(),
          action: 'edited',
          user_id: userId,
          user_email: userEmail,
          user_name: userName,
          details: {
            items_count: items.length,
            new_items_added: newItems.length,
          },
        },
      ]

      // Step 3: Update delivery record
      const { error: updateError } = await supabase
        .from('deliveries')
        .update({
          po_reference: po_reference || null,
          project_id,
          driver_id,
          status,
          from_address,
          to_address,
          from_location_id,
          truck_sortly_folder_id: truck_folder_id,
          activity_log: updatedLog,
        })
        .eq('id', deliveryId)

      if (updateError) throw updateError

      // Step 4: Replace delivery items (delete old, insert new)
      const { error: deleteItemsError } = await supabase
        .from('delivery_items')
        .delete()
        .eq('delivery_id', deliveryId)

      if (deleteItemsError) throw deleteItemsError

      const deliveryItemsToInsert = items.map((item) => ({
        delivery_id: deliveryId,
        sortly_item_id: item.sortly_item_id,
        item_name: item.item_name,
        quantity: item.quantity,
        delivered_quantity: item.delivered_quantity || 0,
        remaining_quantity: item.remaining_quantity || item.quantity,
        notes: item.location || item.notes || null,
        custom_attribute_values: item.custom_attribute_values || null,
      }))

      const { error: insertError } = await supabase
        .from('delivery_items')
        .insert(deliveryItemsToInsert)
        .select()

      if (insertError) throw insertError

      return { id: deliveryId }
    },
    onSuccess: (_data, params) => {
      queryClient.invalidateQueries({ queryKey: deliveryKeys.all })
      queryClient.invalidateQueries({ queryKey: deliveryKeys.detail(params.deliveryId) })
      queryClient.invalidateQueries({ queryKey: deliveryKeys.items(params.deliveryId) })
      queryClient.invalidateQueries({ queryKey: sortlyKeys.items() })
    },
  })
}

// ── Delete Delivery ──────────────────────────────────────────

interface DeleteDeliveryParams {
  deliveryId: number
  deliveryNumber: string
  status: string
  truckSortlyFolderId: number
  fromLocationId: number
  activityLog: ActivityLogEntry[]
  deliveryItems: Array<{
    sortly_item_id: number | null
    item_name: string
    quantity: number
  }>
  userId?: string
  userEmail?: string
  userName?: string
}

export function useDeleteDelivery() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (opts: DeleteDeliveryParams) => {
      const {
        deliveryId,
        deliveryNumber,
        status,
        truckSortlyFolderId,
        fromLocationId,
        activityLog,
        deliveryItems,
        userId,
        userEmail,
        userName,
      } = opts

      // If pending, reverse Sortly moves (move items back from truck to source)
      if (status === 'pending') {
        const deliveryNote = `[Delivery: ${deliveryNumber}]`

        // Fetch all items in truck folder
        const truckItems: Array<{ id: number; name: string; notes?: string; quantity?: number }> = []
        let page = 1
        let hasMore = true

        while (hasMore) {
          const response = await sortlyClient.listItems({
            parent_id: truckSortlyFolderId,
            per_page: 100,
            page,
          })
          const items = response.data || []
          items.forEach((item) => {
            if (item.type === 'item') {
              truckItems.push({
                id: item.id,
                name: item.name,
                notes: item.notes,
                quantity: item.quantity,
              })
            }
          })
          hasMore = items.length === 100
          page++
        }

        // Find tagged items, fall back to name matching
        const taggedItems = truckItems.filter((item) =>
          (item.notes || '').includes(deliveryNote)
        )

        const itemsToMove = taggedItems.length > 0 ? taggedItems : deliveryItems

        for (const item of itemsToMove) {
          try {
            const isTruckItem = 'notes' in item
            const truckItem = isTruckItem
              ? item as { id: number; name: string; quantity?: number }
              : await sortlyClient.findItemInFolder(
                  (item as { item_name: string }).item_name,
                  truckSortlyFolderId
                )

            if (!truckItem) {
              console.warn(`Item "${'item_name' in item ? item.item_name : item.name}" not found in truck`)
              continue
            }

            // Remove delivery note
            await sortlyClient.removeDeliveryNote(truckItem.id, deliveryNumber)

            const quantityToMove = Number(truckItem.quantity) || Number(item.quantity) || 0
            if (quantityToMove <= 0) continue

            // Move back to source
            await sortlyClient.moveItemWithOptions(
              truckItem.id,
              quantityToMove,
              fromLocationId,
              false
            )
          } catch (moveError) {
            const itemName = 'item_name' in item ? item.item_name : (item as { name: string }).name
            console.error(`Failed to move item ${itemName}:`, moveError)
            throw moveError
          }
        }
      }

      // Soft delete with activity log
      const updatedLog = [
        ...activityLog,
        {
          timestamp: new Date().toISOString(),
          action: 'deleted',
          user_id: userId,
          user_email: userEmail,
          user_name: userName,
          details: { status, items_count: deliveryItems.length },
        },
      ]

      const { error } = await supabase
        .from('deliveries')
        .update({
          deleted_at: new Date().toISOString(),
          activity_log: updatedLog,
        })
        .eq('id', deliveryId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: deliveryKeys.all })
      queryClient.invalidateQueries({ queryKey: sortlyKeys.items() })
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
  deliveredItems: Array<{ id: number; delivered_quantity: number }>
  jobSiteFolderId?: number
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
      jobSiteFolderId,
    }: ConfirmDeliveryParams) => {
      let signatureUrl: string | null = null
      let signatureStoragePath: string | null = null

      // Upload signature if provided
      if (signatureBlob) {
        const filePath = `${deliveryId}/${driverId}/${Date.now()}.png`
        const { error: uploadError } = await supabase.storage
          .from('delivery-signatures')
          .upload(filePath, signatureBlob, {
            contentType: 'image/png',
            upsert: true,
          })

        if (uploadError) throw uploadError

        const { data } = supabase.storage
          .from('delivery-signatures')
          .getPublicUrl(filePath)

        signatureUrl = data.publicUrl
        signatureStoragePath = filePath
      }

      // Move items from truck to job site in Sortly
      if (jobSiteFolderId) {
        for (const item of deliveredItems) {
          if (item.delivered_quantity > 0) {
            try {
              await sortlyClient.moveItem(item.id, item.delivered_quantity, jobSiteFolderId)
            } catch (err) {
              console.error(`Failed to move item ${item.id} to job site:`, err)
              // Continue — don't block confirmation for Sortly failures
            }
          }
        }
      }

      // Create confirmation record
      const { error: confirmError } = await supabase
        .from('delivery_confirmations')
        .insert({
          delivery_id: deliveryId,
          driver_id: driverId,
          completed_at: new Date().toISOString(),
          signed_by_name: signedByName,
          signature_url: signatureUrl,
          signature_storage_path: signatureStoragePath,
          status: 'completed',
          notes: notes || null,
        })

      if (confirmError) throw confirmError

      // Update delivery status
      const { error: updateError } = await supabase
        .from('deliveries')
        .update({
          status: 'delivered',
          delivered_at: new Date().toISOString(),
          signature_name: signedByName,
        })
        .eq('id', deliveryId)

      if (updateError) throw updateError
    },
    onSuccess: (_data, params) => {
      queryClient.invalidateQueries({ queryKey: deliveryKeys.all })
      queryClient.invalidateQueries({ queryKey: deliveryKeys.detail(params.deliveryId) })
      queryClient.invalidateQueries({ queryKey: sortlyKeys.items() })
    },
  })
}
