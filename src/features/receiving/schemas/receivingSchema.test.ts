import { describe, expect, it } from 'vitest'
import { receivingItemSchema, receivingSchema } from './receivingSchema'

function baseItem(overrides: Record<string, unknown> = {}) {
  return {
    tempId: 'temp-1',
    item_name: 'Widget',
    part_number: null,
    quantity_ordered: 10,
    quantity_shipped: 10,
    back_order: 0,
    quantity_received: 10,
    confidence: 'high' as const,
    action: 'update' as const,
    sortly_item_id: null,
    sortly_current_quantity: null,
    destination_folder_id: null,
    destination_folder_name: null,
    notes: null,
    tags: [],
    ...overrides,
  }
}

function baseForm(overrides: Record<string, unknown> = {}) {
  return {
    vendor: 'Acme Supply',
    po_number: null,
    date_received: '2026-07-21',
    destination_type: 'project' as const,
    destination_folder_id: 1,
    project_id: 1,
    project_name: 'Project A',
    notes: null,
    items: [baseItem()],
    ...overrides,
  }
}

describe('receivingItemSchema', () => {
  it('accepts a valid item', () => {
    const result = receivingItemSchema.safeParse(baseItem())
    expect(result.success).toBe(true)
  })

  it('rejects quantity_received below 1', () => {
    const result = receivingItemSchema.safeParse(baseItem({ quantity_received: 0 }))
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(
        result.error.issues.some((i) => i.path.join('.') === 'quantity_received'),
      ).toBe(true)
    }
  })

  it('rejects a negative quantity_received', () => {
    const result = receivingItemSchema.safeParse(baseItem({ quantity_received: -1 }))
    expect(result.success).toBe(false)
  })

  it('rejects quantity_shipped below 1', () => {
    const result = receivingItemSchema.safeParse(baseItem({ quantity_shipped: 0 }))
    expect(result.success).toBe(false)
  })

  it('rejects an empty item_name', () => {
    const result = receivingItemSchema.safeParse(baseItem({ item_name: '' }))
    expect(result.success).toBe(false)
  })

  it('allows quantity_ordered and back_order to be zero (min(0))', () => {
    const result = receivingItemSchema.safeParse(
      baseItem({ quantity_ordered: 0, back_order: 0 }),
    )
    expect(result.success).toBe(true)
  })
})

describe('receivingSchema', () => {
  it('accepts a valid form for destination_type "project"', () => {
    const result = receivingSchema.safeParse(baseForm())
    expect(result.success).toBe(true)
  })

  it('accepts a valid form for destination_type "warehouse"', () => {
    const result = receivingSchema.safeParse(
      baseForm({ destination_type: 'warehouse', destination_folder_id: 5, project_id: null, project_name: null }),
    )
    expect(result.success).toBe(true)
  })

  it('rejects a null destination_folder_id with "Please select a project" when destination_type is project', () => {
    const result = receivingSchema.safeParse(baseForm({ destination_folder_id: null }))
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.join('.') === 'destination_folder_id')
      expect(issue?.message).toBe('Please select a project')
    }
  })

  it('rejects a null destination_folder_id with "Please select a destination folder" when destination_type is warehouse', () => {
    const result = receivingSchema.safeParse(
      baseForm({ destination_type: 'warehouse', destination_folder_id: null }),
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.join('.') === 'destination_folder_id')
      expect(issue?.message).toBe('Please select a destination folder')
    }
  })

  it('rejects an empty items array', () => {
    const result = receivingSchema.safeParse(baseForm({ items: [] }))
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.join('.') === 'items')).toBe(true)
    }
  })

  it('rejects a missing vendor', () => {
    const result = receivingSchema.safeParse(baseForm({ vendor: '' }))
    expect(result.success).toBe(false)
  })

  it('rejects a missing date_received', () => {
    const result = receivingSchema.safeParse(baseForm({ date_received: '' }))
    expect(result.success).toBe(false)
  })
})
