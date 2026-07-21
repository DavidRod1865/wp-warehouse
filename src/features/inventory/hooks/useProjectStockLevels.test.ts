import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { createMockSupabaseClient } from '../../../test/mockSupabase'
import { createQueryWrapper } from '../../../test/queryWrapper'

const mockClient = vi.hoisted(() => {
  return { current: null as unknown as ReturnType<typeof import('../../../test/mockSupabase').createMockSupabaseClient> }
})

vi.mock('../../../lib/supabase', () => ({
  get supabase() {
    return mockClient.current
  },
}))

import { useProjectStockLevels, useProjectReturns } from './useProjectStockLevels'

describe('useProjectStockLevels', () => {
  beforeEach(() => {
    mockClient.current = createMockSupabaseClient()
  })

  describe('useProjectStockLevels', () => {
    it('queries stock_levels joined with items and locations, filtered by project_id', async () => {
      mockClient.current.queueTableResult('stock_levels', {
        data: [
          {
            id: 1,
            location_id: 10,
            item_id: 5,
            quantity: 3,
            items: { name: 'Widget', part_number: 'W-1' },
            locations: { id: 10, name: 'Proj - Rigging Yard', location_type: 'rigging_yard', project_id: 9 },
          },
        ],
        error: null,
      })

      const wrapper = createQueryWrapper()
      const { result } = renderHook(() => useProjectStockLevels(9), { wrapper })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(mockClient.current.from).toHaveBeenCalledWith('stock_levels')
      const builderInstance = mockClient.current.from.mock.results[0].value
      expect(builderInstance.select).toHaveBeenCalledWith(
        '*, items(name, part_number), locations!inner(id, name, location_type, project_id)'
      )
      expect(builderInstance.eq).toHaveBeenCalledWith('locations.project_id', 9)

      expect(result.current.data).toEqual([
        {
          id: 1,
          location_id: 10,
          item_id: 5,
          quantity: 3,
          items: { name: 'Widget', part_number: 'W-1' },
          locations: { id: 10, name: 'Proj - Rigging Yard', location_type: 'rigging_yard', project_id: 9 },
          item: { name: 'Widget', part_number: 'W-1' },
          location: { id: 10, name: 'Proj - Rigging Yard', location_type: 'rigging_yard', project_id: 9 },
        },
      ])
    })

    it('is disabled when projectId is null', () => {
      const wrapper = createQueryWrapper()
      const { result } = renderHook(() => useProjectStockLevels(null), { wrapper })
      expect(result.current.fetchStatus).toBe('idle')
      expect(mockClient.current.from).not.toHaveBeenCalledWith('stock_levels')
    })
  })

  describe('useProjectReturns', () => {
    it('fetches project location ids, then movements filtered by movement_type and from_location_id, ordered desc', async () => {
      mockClient.current.queueTableResult('locations', {
        data: [{ id: 10 }, { id: 11 }],
        error: null,
      })
      mockClient.current.queueTableResult('inventory_movements', {
        data: [
          {
            id: 100,
            movement_type: 'return',
            from_location_id: 10,
            to_location_id: 20,
            item_id: 5,
            quantity: 2,
            created_at: '2026-07-20T00:00:00Z',
            items: { name: 'Widget' },
            to_location: { name: 'Warehouse' },
          },
        ],
        error: null,
      })

      const wrapper = createQueryWrapper()
      const { result } = renderHook(() => useProjectReturns(9), { wrapper })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(mockClient.current.from).toHaveBeenCalledWith('locations')
      expect(mockClient.current.from).toHaveBeenCalledWith('inventory_movements')

      const locationsBuilder = mockClient.current.from.mock.results[0].value
      expect(locationsBuilder.select).toHaveBeenCalledWith('id')
      expect(locationsBuilder.eq).toHaveBeenCalledWith('project_id', 9)

      const movementsBuilder = mockClient.current.from.mock.results[1].value
      expect(movementsBuilder.eq).toHaveBeenCalledWith('movement_type', 'return')
      expect(movementsBuilder.in).toHaveBeenCalledWith('from_location_id', [10, 11])
      expect(movementsBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false })

      expect(result.current.data?.[0].item).toEqual({ name: 'Widget' })
      expect(result.current.data?.[0].to_location).toEqual({ name: 'Warehouse' })
    })

    it('returns an empty array without querying movements when the project has no locations', async () => {
      mockClient.current.queueTableResult('locations', { data: [], error: null })

      const wrapper = createQueryWrapper()
      const { result } = renderHook(() => useProjectReturns(9), { wrapper })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(result.current.data).toEqual([])
      expect(mockClient.current.from).not.toHaveBeenCalledWith('inventory_movements')
    })
  })
})
