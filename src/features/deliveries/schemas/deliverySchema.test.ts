import { describe, expect, it } from 'vitest'
import { deliverySchema } from './deliverySchema'

function baseAddress(overrides: Record<string, unknown> = {}) {
  return {
    company_name: 'WP Warehouse',
    street_address: '123 Main St',
    city: 'Anytown',
    state: 'NY',
    zip_code: '10001',
    phone: '',
    ...overrides,
  }
}

function baseItem(overrides: Record<string, unknown> = {}) {
  return {
    item_id: 1,
    item_name: 'Widget',
    quantity: 5,
    delivered_quantity: 0,
    remaining_quantity: 5,
    notes: null,
    ...overrides,
  }
}

function baseDelivery(overrides: Record<string, unknown> = {}) {
  return {
    po_reference: '',
    project_id: 1,
    truck_location_id: 1,
    from_location_id: 2,
    from_address: baseAddress(),
    to_address: baseAddress(),
    items: [baseItem()],
    driver_id: null,
    status: 'draft' as const,
    delivery_type: 'commercial' as const,
    ...overrides,
  }
}

describe('deliverySchema', () => {
  it('accepts a valid payload', () => {
    const result = deliverySchema.safeParse(baseDelivery())
    expect(result.success).toBe(true)
  })

  it('raises an issue at truck_location_id with "Please select a truck" when missing', () => {
    const result = deliverySchema.safeParse(baseDelivery({ truck_location_id: null }))
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.join('.') === 'truck_location_id')
      expect(issue?.message).toBe('Please select a truck')
    }
  })

  it('raises an issue at from_location_id with "Please select a source location" when missing', () => {
    const result = deliverySchema.safeParse(baseDelivery({ from_location_id: null }))
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.join('.') === 'from_location_id')
      expect(issue?.message).toBe('Please select a source location')
    }
  })

  it('raises both issues when truck and from location are both missing', () => {
    const result = deliverySchema.safeParse(
      baseDelivery({ truck_location_id: null, from_location_id: null }),
    )
    expect(result.success).toBe(false)
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'))
      expect(paths).toContain('truck_location_id')
      expect(paths).toContain('from_location_id')
    }
  })

  it('rejects an empty items array', () => {
    const result = deliverySchema.safeParse(baseDelivery({ items: [] }))
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.join('.') === 'items')).toBe(true)
    }
  })

  it('rejects an item with quantity below 1', () => {
    const result = deliverySchema.safeParse(
      baseDelivery({ items: [baseItem({ quantity: 0 })] }),
    )
    expect(result.success).toBe(false)
  })

  it('rejects an item with an empty item_name', () => {
    const result = deliverySchema.safeParse(
      baseDelivery({ items: [baseItem({ item_name: '' })] }),
    )
    expect(result.success).toBe(false)
  })

  it('rejects a missing street_address on from_address', () => {
    const result = deliverySchema.safeParse(
      baseDelivery({ from_address: baseAddress({ street_address: '' }) }),
    )
    expect(result.success).toBe(false)
  })

  it('rejects project_id below 1', () => {
    const result = deliverySchema.safeParse(baseDelivery({ project_id: 0 }))
    expect(result.success).toBe(false)
  })
})
