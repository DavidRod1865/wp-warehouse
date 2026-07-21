import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { createMockSupabaseClient } from '../../../test/mockSupabase'
import { createTestQueryClient, createQueryWrapper } from '../../../test/queryWrapper'

const mockClient = vi.hoisted(() => {
  return { current: null as unknown as ReturnType<typeof import('../../../test/mockSupabase').createMockSupabaseClient> }
})

vi.mock('../../../lib/supabase', () => ({
  get supabase() {
    return mockClient.current
  },
}))

import { useConfirmReceipt } from './useReceivingMutations'
import { receivingKeys } from './receivingKeys'
import { poKeys } from '../../purchase-orders/hooks/poKeys'
import { inventoryKeys } from '../../inventory/hooks/inventoryKeys'
import type { ConfirmReceiptParams, ReceivingLineItem } from '../types'

function baseLineItem(overrides: Partial<ReceivingLineItem> = {}): ReceivingLineItem {
  return {
    tempId: 'temp-1',
    item_name: 'Widget',
    part_number: null,
    quantity_ordered: 10,
    quantity_shipped: 10,
    back_order: 0,
    quantity_received: 10,
    confidence: 'high',
    action: 'update',
    item_id: 5,
    item_name_linked: 'Widget',
    current_stock_quantity: 0,
    po_line_item_id: 20,
    po_line_suggestion: null,
    destination_location_id: null,
    destination_location_name: null,
    notes: null,
    ...overrides,
  }
}

function baseParams(overrides: Partial<ConfirmReceiptParams> = {}): ConfirmReceiptParams {
  return {
    vendor: 'Acme Supply',
    vendor_id: 1,
    po_id: 9,
    po_number: 'PO-1',
    date_received: '2026-07-21',
    destination_type: 'warehouse',
    destination_location_id: 42,
    project_name: null,
    project_id: null,
    notes: null,
    items: [baseLineItem()],
    ...overrides,
  }
}

describe('useConfirmReceipt', () => {
  beforeEach(() => {
    mockClient.current = createMockSupabaseClient()
  })

  it('throws before any insert/rpc when there are no active items', async () => {
    const wrapper = createQueryWrapper()
    const { result } = renderHook(() => useConfirmReceipt(), { wrapper })

    await expect(
      result.current.mutateAsync(
        baseParams({ items: [baseLineItem({ action: 'skip' }), baseLineItem({ action: 'pending' })] }),
      ),
    ).rejects.toThrow(/No items to receive/)

    expect(mockClient.current.from).not.toHaveBeenCalled()
    expect(mockClient.current.rpc).not.toHaveBeenCalled()
  })

  it('reuses an existing receiving_log for today and builds the confirm_receipt payload', async () => {
    mockClient.current.queueTableResult('receiving_logs', { data: { id: 1 }, error: null })
    mockClient.current.queueTableResult('receiving_log_entries', { data: { id: 100 }, error: null })
    mockClient.current.rpc.mockResolvedValueOnce({
      data: { success: true, entry_id: 100, items_processed: 1, po_id: 9, po_status: 'partial' },
      error: null,
    })

    const wrapper = createQueryWrapper()
    const { result } = renderHook(() => useConfirmReceipt(), { wrapper })

    const returned = await result.current.mutateAsync(baseParams())

    expect(returned).toEqual({ entryId: 100, itemsProcessed: 1, poId: 9, poStatus: 'partial' })

    // Only one insert into receiving_logs would have occurred if we created a
    // new one; here the select() found an existing log so insert must not run.
    expect(mockClient.current.rpc).toHaveBeenCalledWith('confirm_receipt', {
      p_entry_id: 100,
      p_items: [
        {
          po_line_item_id: 20,
          item_id: 5,
          new_item: null,
          item_name: 'Widget',
          part_number: null,
          quantity_received: 10,
          destination_location_id: 42,
          notes: null,
        },
      ],
      p_notes: null,
    })
  })

  it('creates a new receiving_log when none exists for today', async () => {
    // First from('receiving_logs') call is the maybeSingle() select — no row found.
    mockClient.current.queueTableResult('receiving_logs', { data: null, error: null })
    // Second from('receiving_logs') call is the insert — returns the new log id.
    mockClient.current.queueTableResult('receiving_logs', { data: { id: 2 }, error: null })
    mockClient.current.queueTableResult('receiving_log_entries', { data: { id: 200 }, error: null })
    mockClient.current.rpc.mockResolvedValueOnce({
      data: { success: true, entry_id: 200, items_processed: 1, po_id: null, po_status: null },
      error: null,
    })

    const wrapper = createQueryWrapper()
    const { result } = renderHook(() => useConfirmReceipt(), { wrapper })

    const returned = await result.current.mutateAsync(baseParams())

    expect(returned.entryId).toBe(200)
    // 2 calls for receiving_logs (select + insert) + 1 for receiving_log_entries insert.
    const fromCalls = mockClient.current.from.mock.calls.map((c) => c[0])
    expect(fromCalls.filter((t) => t === 'receiving_logs')).toHaveLength(2)
    expect(fromCalls).toContain('receiving_log_entries')
  })

  it('includes new_item only when item_id is null', async () => {
    mockClient.current.queueTableResult('receiving_logs', { data: { id: 1 }, error: null })
    mockClient.current.queueTableResult('receiving_log_entries', { data: { id: 100 }, error: null })
    mockClient.current.rpc.mockResolvedValueOnce({
      data: { success: true, entry_id: 100, items_processed: 1, po_id: null, po_status: null },
      error: null,
    })

    const wrapper = createQueryWrapper()
    const { result } = renderHook(() => useConfirmReceipt(), { wrapper })

    await result.current.mutateAsync(
      baseParams({
        items: [
          baseLineItem({
            item_id: null,
            item_name: 'New Gadget',
            part_number: 'PN-9',
            po_line_item_id: null,
          }),
        ],
      }),
    )

    expect(mockClient.current.rpc).toHaveBeenCalledWith(
      'confirm_receipt',
      expect.objectContaining({
        p_items: [
          expect.objectContaining({
            item_id: null,
            new_item: { name: 'New Gadget', part_number: 'PN-9' },
          }),
        ],
      }),
    )
  })

  it('invalidates receivingKeys, poKeys and inventory keys on success', async () => {
    mockClient.current.queueTableResult('receiving_logs', { data: { id: 1 }, error: null })
    mockClient.current.queueTableResult('receiving_log_entries', { data: { id: 100 }, error: null })
    mockClient.current.rpc.mockResolvedValueOnce({
      data: { success: true, entry_id: 100, items_processed: 1, po_id: 9, po_status: 'received' },
      error: null,
    })

    const queryClient = createTestQueryClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    const wrapper = createQueryWrapper(queryClient)
    const { result } = renderHook(() => useConfirmReceipt(), { wrapper })

    await result.current.mutateAsync(baseParams())

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: receivingKeys.all })
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: poKeys.all() })
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: inventoryKeys.stockLevels() })
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: inventoryKeys.items() })
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: inventoryKeys.movements() })
    })
  })

  it('throws when destination_location_id is null', async () => {
    const wrapper = createQueryWrapper()
    const { result } = renderHook(() => useConfirmReceipt(), { wrapper })

    await expect(
      result.current.mutateAsync(baseParams({ destination_location_id: null })),
    ).rejects.toThrow('A destination location is required.')

    expect(mockClient.current.from).not.toHaveBeenCalled()
  })
})
