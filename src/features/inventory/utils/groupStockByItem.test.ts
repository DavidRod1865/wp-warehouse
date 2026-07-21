import { describe, expect, it } from 'vitest'
import { groupStockByItem } from './groupStockByItem'
import type { StockLevel } from '../types'

function stock(overrides: Partial<StockLevel>): StockLevel {
  return {
    id: 1,
    location_id: 1,
    item_id: 1,
    quantity: 0,
    updated_at: '2026-07-01T00:00:00Z',
    ...overrides,
  }
}

describe('groupStockByItem', () => {
  it('sums quantity across locations for the same item', () => {
    const groups = groupStockByItem([
      stock({ id: 1, item_id: 5, location_id: 10, quantity: 0 }),
      stock({ id: 2, item_id: 5, location_id: 11, quantity: 1 }),
      stock({ id: 3, item_id: 5, location_id: 12, quantity: 0 }),
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({ item_id: 5, totalQuantity: 1 })
    expect(groups[0].locations).toHaveLength(3)
  })

  it('keeps items separate and preserves the joined item payload', () => {
    const groups = groupStockByItem([
      stock({ id: 1, item_id: 1, quantity: 2, item: { id: 1, name: 'Transformer', part_number: 'T-1' } }),
      stock({ id: 2, item_id: 2, quantity: 3, item: { id: 2, name: 'Breaker', part_number: null } }),
    ])

    expect(groups.map((g) => g.item_id)).toEqual([1, 2])
    expect(groups[0].item).toEqual({ id: 1, name: 'Transformer', part_number: 'T-1' })
    expect(groups[0].totalQuantity).toBe(2)
    expect(groups[1].totalQuantity).toBe(3)
  })

  it('returns an item with total 0 when all of its locations are 0', () => {
    const groups = groupStockByItem([
      stock({ id: 1, item_id: 5, location_id: 10, quantity: 0 }),
      stock({ id: 2, item_id: 5, location_id: 11, quantity: 0 }),
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0].totalQuantity).toBe(0)
  })

  it('returns an empty array for no stock levels', () => {
    expect(groupStockByItem([])).toEqual([])
  })
})
