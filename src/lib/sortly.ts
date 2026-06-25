/**
 * sortly.ts — Sortly API client
 *
 * All Sortly API calls are proxied through the `sortly-proxy` Edge Function
 * to keep the SORTLY_SECRET_KEY server-side. The frontend never sees the key.
 *
 * Call flow: sortlyClient.method() → sortlyProxy() → supabase.functions.invoke("sortly-proxy")
 *            → Edge Function verifies JWT → forwards to api.sortly.com → returns response
 *
 * Key operations and their use cases:
 *   - copyItem()  → Warehouse → Truck (delivery creation, keeps original)
 *   - moveItem()  → Truck → Job Site (delivery confirmation, removes from truck)
 *   - moveItemWithOptions() → Generic move with configurable zero-quantity behavior
 *   - addDeliveryNote() → Tags items with [Delivery: DEL-XXX] for tracking
 *   - removeDeliveryNote() → Untags items during delivery deletion/rollback
 *   - findItemInFolder() → Locates an item by name within a folder (paginated)
 */
import { supabase } from './supabase'
import type {
  SortlyItem,
  SortlyApiResponse,
  CreateItemParams,
  CopyItemParams,
  SearchItemsParams,
  SortlyCustomField,
  SortlyAlert,
  CreateAlertParams,
  UpdateAlertParams,
} from '../types/sortly'

/**
 * Calls the sortly-proxy Edge Function with the user's JWT.
 * All Sortly API traffic flows through this single helper.
 */
async function sortlyProxy<T>(
  action: string,
  params: Record<string, unknown> = {}
): Promise<T> {
  const { data, error } = await supabase.functions.invoke('sortly-proxy', {
    body: { action, params },
  })

  if (error) {
    let message = error.message
    if (error.context instanceof Response) {
      try {
        const body = await error.context.json()
        message = body.error || message
        if (body.details) message += ` — ${body.details}`
      } catch {
        // body wasn't JSON or already consumed
      }
    }
    throw new Error(`Sortly proxy error [${action}]: ${message}`)
  }

  return data as T
}

export const sortlyClient = {
  // ── Items ─────────────────────────────────────────

  async listItems(params?: {
    parent_id?: number
    per_page?: number
    page?: number
    type?: string
    include?: string
    folder_id?: number
  }): Promise<SortlyApiResponse> {
    return sortlyProxy<SortlyApiResponse>('listItems', { ...params })
  },

  async getItem(
    id: number,
    include: string = 'photos,custom_attributes'
  ): Promise<{ data: SortlyItem }> {
    return sortlyProxy<{ data: SortlyItem }>('getItem', {
      itemId: id,
      include,
    })
  },

  async createItem(
    options: CreateItemParams | { name: string; quantity: number; parent_id: number }
  ): Promise<{ data: SortlyItem }> {
    const body = { type: 'item' as const, ...options }
    return sortlyProxy<{ data: SortlyItem }>('createItem', body)
  },

  async updateItem(
    itemId: number,
    updates: Partial<SortlyItem>
  ): Promise<{ success: true } | { data: SortlyItem }> {
    return sortlyProxy('updateItem', { itemId, ...updates })
  },

  async deleteItem(itemId: number): Promise<{ success: true }> {
    try {
      return await sortlyProxy<{ success: true }>('deleteItem', { itemId })
    } catch (err) {
      // Sortly returns 204 No Content — Supabase client may fail to parse the empty body
      if (err instanceof Error && err.message.includes('Unexpected end of JSON input')) {
        return { success: true }
      }
      throw err
    }
  },

  async copyItem(
    itemId: number,
    quantity: number,
    toFolderId: number,
    options?: Omit<CopyItemParams, 'quantity' | 'folder_id'>
  ): Promise<{ data: SortlyItem }> {
    return sortlyProxy<{ data: SortlyItem }>('copyItem', {
      itemId,
      quantity,
      folder_id: toFolderId,
      ...options,
    })
  },

  async moveItem(
    itemId: number,
    quantity: number,
    toFolderId: number
  ): Promise<{ data: SortlyItem }> {
    return sortlyProxy<{ data: SortlyItem }>('moveItem', {
      itemId,
      quantity,
      folder_id: toFolderId,
      leave_zero_quantity: false,
    })
  },

  async moveItemWithOptions(
    itemId: number,
    quantity: number,
    toFolderId: number,
    leaveZeroInSource: boolean
  ): Promise<{ data: SortlyItem }> {
    return sortlyProxy<{ data: SortlyItem }>('moveItem', {
      itemId,
      quantity,
      folder_id: toFolderId,
      leave_zero_quantity: leaveZeroInSource,
    })
  },

  // ── Search / Recent ───────────────────────────────

  async searchItems(params: SearchItemsParams): Promise<SortlyApiResponse> {
    return sortlyProxy<SortlyApiResponse>('searchItems', { ...params })
  },

  async getRecentItems(params?: {
    per_page?: number
    page?: number
    updated_since?: string
    include?: string
  }): Promise<SortlyApiResponse> {
    return sortlyProxy<SortlyApiResponse>('getRecentItems', { ...params })
  },

  // ── Custom Fields ─────────────────────────────────

  async listCustomFields(params?: {
    per_page?: number
    page?: number
  }): Promise<{ data: SortlyCustomField[] }> {
    return sortlyProxy<{ data: SortlyCustomField[] }>('listCustomFields', {
      ...params,
    })
  },

  // ── Alerts ────────────────────────────────────────

  async listAlerts(params?: {
    per_page?: number
    page?: number
  }): Promise<{ data: SortlyAlert[] }> {
    return sortlyProxy<{ data: SortlyAlert[] }>('listAlerts', { ...params })
  },

  async createAlert(params: CreateAlertParams): Promise<{ data: SortlyAlert }> {
    return sortlyProxy<{ data: SortlyAlert }>('createAlert', { ...params })
  },

  async updateAlert(
    alertId: number,
    updates: UpdateAlertParams
  ): Promise<{ data: SortlyAlert }> {
    return sortlyProxy<{ data: SortlyAlert }>('updateAlert', {
      alertId,
      ...updates,
    })
  },

  async deleteAlert(alertId: number): Promise<{ success: true }> {
    return sortlyProxy<{ success: true }>('deleteAlert', { alertId })
  },

  // ── Helper methods (composite, stay client-side) ──

  async findItemInFolder(
    itemName: string,
    folderId: number
  ): Promise<SortlyItem | null> {
    try {
      const allItems: SortlyItem[] = []
      let page = 1
      let hasMore = true

      while (hasMore) {
        const response = await this.listItems({
          parent_id: folderId,
          per_page: 100,
          page,
        })
        if (response.data && response.data.length > 0) {
          allItems.push(...response.data)
          hasMore = response.data.length === 100
          page++
        } else {
          hasMore = false
        }
      }

      const item = allItems.find(
        (i: SortlyItem) =>
          i.name.trim().toLowerCase() === itemName.trim().toLowerCase() &&
          i.parent_id === folderId
      )

      if (!item) {
        console.warn(`Item "${itemName}" not found in folder ${folderId}`)
      }

      return item ?? null
    } catch (error) {
      console.error('Failed to find item in folder:', error)
      return null
    }
  },

  async addDeliveryNote(
    itemId: number,
    deliveryNumber: string
  ): Promise<void> {
    try {
      const itemData = await this.getItem(itemId)
      const item = itemData.data
      if (!item) {
        console.warn(`Item ${itemId} not found`)
        return
      }

      const currentNotes = item.notes || ''
      const deliveryNote = `[Delivery: ${deliveryNumber}]`

      if (!currentNotes.includes(deliveryNote)) {
        const updatedNotes = currentNotes
          ? `${currentNotes}\n${deliveryNote}`
          : deliveryNote
        await this.updateItem(itemId, { notes: updatedNotes })
      }
    } catch (error) {
      console.error('Failed to add delivery note:', error)
    }
  },

  async removeDeliveryNote(
    itemId: number,
    deliveryNumber: string
  ): Promise<void> {
    try {
      const itemData = await this.getItem(itemId)
      const item = itemData.data
      if (!item) {
        console.warn(`Item ${itemId} not found`)
        return
      }

      const currentNotes = item.notes || ''
      const deliveryNote = `[Delivery: ${deliveryNumber}]`

      if (currentNotes.includes(deliveryNote)) {
        const updatedNotes = currentNotes
          .replace(`\n${deliveryNote}`, '')
          .replace(deliveryNote, '')
          .trim()
        await this.updateItem(itemId, { notes: updatedNotes })
      }
    } catch (error) {
      console.error('Failed to remove delivery note:', error)
    }
  },
}
