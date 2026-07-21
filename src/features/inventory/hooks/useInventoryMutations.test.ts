import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { createMockSupabaseClient } from '../../../test/mockSupabase'
import { createTestQueryClient, createQueryWrapper } from '../../../test/queryWrapper'

const mockClient = vi.hoisted(() => {
  // Import inside the hoisted factory isn't possible, so we build a minimal
  // stand-in here and replace its methods with the real mock in beforeEach.
  return { current: null as unknown as ReturnType<typeof import('../../../test/mockSupabase').createMockSupabaseClient> }
})

vi.mock('../../../lib/supabase', () => ({
  get supabase() {
    return mockClient.current
  },
}))

import { useMoveInventory, useAdjustInventory } from './useInventoryMutations'
import { inventoryKeys } from './inventoryKeys'

describe('useInventoryMutations', () => {
  beforeEach(() => {
    mockClient.current = createMockSupabaseClient()
  })

  describe('useMoveInventory', () => {
    it('calls rpc("move_inventory") with correct p_* keys and null coalescing', async () => {
      mockClient.current.rpc.mockResolvedValueOnce({ data: { success: true }, error: null })
      const queryClient = createTestQueryClient()
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
      const wrapper = createQueryWrapper(queryClient)

      const { result } = renderHook(() => useMoveInventory(), { wrapper })

      await result.current.mutateAsync({
        item_id: 1,
        quantity: 5,
        movement_type: 'transfer',
        // from/to/reference/notes omitted to exercise `|| null` coalescing
      })

      expect(mockClient.current.rpc).toHaveBeenCalledWith('move_inventory', {
        p_item_id: 1,
        p_quantity: 5,
        p_movement_type: 'transfer',
        p_from_location_id: null,
        p_to_location_id: null,
        p_reference_type: null,
        p_reference_id: null,
        p_notes: null,
      })

      await waitFor(() => {
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: inventoryKeys.stockLevels() })
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: inventoryKeys.allStockByItem() })
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: inventoryKeys.movements() })
      })
    })

    it('passes through explicit from/to/reference/notes values', async () => {
      mockClient.current.rpc.mockResolvedValueOnce({ data: { success: true }, error: null })
      const wrapper = createQueryWrapper()
      const { result } = renderHook(() => useMoveInventory(), { wrapper })

      await result.current.mutateAsync({
        item_id: 2,
        quantity: 3,
        movement_type: 'receive',
        from_location_id: 10,
        to_location_id: 20,
        reference_type: 'delivery',
        reference_id: 99,
        notes: 'note',
      })

      expect(mockClient.current.rpc).toHaveBeenCalledWith('move_inventory', {
        p_item_id: 2,
        p_quantity: 3,
        p_movement_type: 'receive',
        p_from_location_id: 10,
        p_to_location_id: 20,
        p_reference_type: 'delivery',
        p_reference_id: 99,
        p_notes: 'note',
      })
    })

    it('throws when the RPC returns an error', async () => {
      mockClient.current.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'boom' },
      })
      const wrapper = createQueryWrapper()
      const { result } = renderHook(() => useMoveInventory(), { wrapper })

      await expect(
        result.current.mutateAsync({
          item_id: 1,
          quantity: 1,
          movement_type: 'adjust',
        }),
      ).rejects.toBeTruthy()
    })
  })

  describe('useAdjustInventory', () => {
    it('calls rpc("adjust_inventory") with correct p_* keys and invalidates stock/movement keys', async () => {
      mockClient.current.rpc.mockResolvedValueOnce({ data: { success: true }, error: null })
      const queryClient = createTestQueryClient()
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
      const wrapper = createQueryWrapper(queryClient)

      const { result } = renderHook(() => useAdjustInventory(), { wrapper })

      await result.current.mutateAsync({
        location_id: 5,
        item_id: 7,
        new_quantity: 42,
        reason: 'cycle_count',
      })

      expect(mockClient.current.rpc).toHaveBeenCalledWith('adjust_inventory', {
        p_location_id: 5,
        p_item_id: 7,
        p_new_quantity: 42,
        p_reason: 'cycle_count',
        p_notes: null,
      })

      await waitFor(() => {
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: inventoryKeys.stockLevels() })
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: inventoryKeys.allStockByItem() })
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: inventoryKeys.movements() })
      })
    })

    it('passes through an explicit notes value', async () => {
      mockClient.current.rpc.mockResolvedValueOnce({ data: { success: true }, error: null })
      const wrapper = createQueryWrapper()
      const { result } = renderHook(() => useAdjustInventory(), { wrapper })

      await result.current.mutateAsync({
        location_id: 5,
        item_id: 7,
        new_quantity: 42,
        reason: 'cycle_count',
        notes: 'discrepancy found',
      })

      expect(mockClient.current.rpc).toHaveBeenCalledWith('adjust_inventory', {
        p_location_id: 5,
        p_item_id: 7,
        p_new_quantity: 42,
        p_reason: 'cycle_count',
        p_notes: 'discrepancy found',
      })
    })
  })
})
