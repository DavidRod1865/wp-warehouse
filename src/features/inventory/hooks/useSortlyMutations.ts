/**
 * useSortlyMutations — Mutation hooks for Sortly write operations
 *
 * Each mutation automatically invalidates relevant Sortly query keys on success.
 * This replaces the manual `invalidateCache()` calls from the old codebase.
 *
 * Key operations:
 *   useCopyItem()   → Warehouse → Truck (delivery creation)
 *   useMoveItem()   → Truck → Job Site (delivery confirmation)
 *   useCreateItem() → Add new inventory item
 *   useUpdateItem() → Edit item details
 *   useDeleteItem() → Remove item
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { sortlyClient } from '../../../lib/sortly'
import { sortlyKeys } from './sortlyKeys'
import type { SortlyItem, CreateItemParams, CopyItemParams } from '../../../types/sortly'

export function useCopyItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: {
      itemId: number
      quantity: number
      toFolderId: number
      options?: Omit<CopyItemParams, 'quantity' | 'folder_id'>
    }) => {
      const result = await sortlyClient.copyItem(
        params.itemId,
        params.quantity,
        params.toFolderId,
        params.options
      )
      return result.data
    },
    onSuccess: (_data, params) => {
      // Invalidate source and destination folder item caches
      queryClient.invalidateQueries({ queryKey: sortlyKeys.items() })
      queryClient.invalidateQueries({ queryKey: sortlyKeys.itemList(params.toFolderId) })
    },
  })
}

export function useMoveItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: {
      itemId: number
      quantity: number
      toFolderId: number
      leaveZeroInSource?: boolean
    }) => {
      const result = params.leaveZeroInSource !== undefined
        ? await sortlyClient.moveItemWithOptions(
            params.itemId,
            params.quantity,
            params.toFolderId,
            params.leaveZeroInSource
          )
        : await sortlyClient.moveItem(
            params.itemId,
            params.quantity,
            params.toFolderId
          )
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sortlyKeys.items() })
    },
  })
}

export function useCreateItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: CreateItemParams | { name: string; quantity: number; parent_id: number }) => {
      const result = await sortlyClient.createItem(params)
      return result.data
    },
    onSuccess: (_data, params) => {
      const parentId = 'parent_id' in params ? params.parent_id : undefined
      if (parentId) {
        queryClient.invalidateQueries({ queryKey: sortlyKeys.itemList(parentId) })
      }
      queryClient.invalidateQueries({ queryKey: sortlyKeys.items() })
    },
  })
}

export function useUpdateItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: { itemId: number; updates: Partial<SortlyItem> }) => {
      return sortlyClient.updateItem(params.itemId, params.updates)
    },
    onSuccess: (_data, params) => {
      queryClient.invalidateQueries({ queryKey: sortlyKeys.itemDetail(params.itemId) })
      queryClient.invalidateQueries({ queryKey: sortlyKeys.items() })
    },
  })
}

export function useDeleteItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (itemId: number) => {
      return sortlyClient.deleteItem(itemId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sortlyKeys.items() })
    },
  })
}

export function useAddDeliveryNote() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: { itemId: number; deliveryNumber: string }) => {
      await sortlyClient.addDeliveryNote(params.itemId, params.deliveryNumber)
    },
    onSuccess: (_data, params) => {
      queryClient.invalidateQueries({ queryKey: sortlyKeys.itemDetail(params.itemId) })
    },
  })
}

export function useRemoveDeliveryNote() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: { itemId: number; deliveryNumber: string }) => {
      await sortlyClient.removeDeliveryNote(params.itemId, params.deliveryNumber)
    },
    onSuccess: (_data, params) => {
      queryClient.invalidateQueries({ queryKey: sortlyKeys.itemDetail(params.itemId) })
    },
  })
}
