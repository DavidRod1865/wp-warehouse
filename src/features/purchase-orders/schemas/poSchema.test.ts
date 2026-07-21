import { describe, expect, it } from 'vitest'
import { poFormSchema, poLineItemSchema } from './poSchema'

function baseLine(overrides: Partial<Parameters<typeof poLineItemSchema.parse>[0]> = {}) {
  return {
    line_number: 1,
    description: 'Widget',
    part_number: null,
    quantity_ordered: 10,
    unit_price: 5,
    notes: null,
    ...overrides,
  }
}

function basePo(overrides: Record<string, unknown> = {}) {
  return {
    po_number: 'PO-1',
    vendor_id: 1,
    project_id: 1,
    po_date: null,
    pricing_mode: 'per_line' as const,
    lump_sum_amount: null,
    lines: [baseLine()],
    notes: null,
    ...overrides,
  }
}

describe('poFormSchema', () => {
  it('accepts a valid per-line PO', () => {
    const result = poFormSchema.safeParse(basePo())
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.lump_sum_amount).toBeNull()
      expect(result.data.lines[0].unit_price).toBe(5)
    }
  })

  it('rejects empty lines array', () => {
    const result = poFormSchema.safeParse(basePo({ lines: [] }))
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.join('.') === 'lines')).toBe(true)
    }
  })

  it('rejects non-positive quantity_ordered', () => {
    const result = poLineItemSchema.safeParse(baseLine({ quantity_ordered: 0 }))
    expect(result.success).toBe(false)
  })

  it('rejects negative quantity_ordered', () => {
    const result = poLineItemSchema.safeParse(baseLine({ quantity_ordered: -5 }))
    expect(result.success).toBe(false)
  })

  describe('lump_sum pricing mode', () => {
    it('accepts a positive lump_sum_amount and nulls out line unit_price on transform', () => {
      const result = poFormSchema.safeParse(
        basePo({ pricing_mode: 'lump_sum', lump_sum_amount: 1000 }),
      )
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.lines[0].unit_price).toBeNull()
        expect(result.data.lump_sum_amount).toBe(1000)
      }
    })

    it('rejects a lump_sum_amount of zero', () => {
      const result = poFormSchema.safeParse(
        basePo({ pricing_mode: 'lump_sum', lump_sum_amount: 0 }),
      )
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(
          result.error.issues.some((i) => i.path.join('.') === 'lump_sum_amount'),
        ).toBe(true)
      }
    })

    it('rejects a negative lump_sum_amount', () => {
      const result = poFormSchema.safeParse(
        basePo({ pricing_mode: 'lump_sum', lump_sum_amount: -50 }),
      )
      expect(result.success).toBe(false)
    })

    it('allows a null lump_sum_amount (no superRefine issue raised)', () => {
      // superRefine only checks `!= null && <= 0`; null skips the check entirely.
      const result = poFormSchema.safeParse(
        basePo({ pricing_mode: 'lump_sum', lump_sum_amount: null }),
      )
      expect(result.success).toBe(true)
    })
  })

  describe('per_line pricing mode transform', () => {
    it('forces lump_sum_amount to null even if one was supplied', () => {
      const result = poFormSchema.safeParse(
        basePo({ pricing_mode: 'per_line', lump_sum_amount: 500 }),
      )
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.lump_sum_amount).toBeNull()
      }
    })
  })

  it('coerces empty-string unit_price to null via nullableNumber', () => {
    const result = poLineItemSchema.safeParse(baseLine({ unit_price: '' as unknown as number }))
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.unit_price).toBeNull()
    }
  })
})
