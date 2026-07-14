import { z } from 'zod'

/**
 * Coerce empty string / NaN from number inputs to null.
 * The cast restores a typed input — z.preprocess types its input as unknown,
 * which degrades z.input<> for the whole form to {} and breaks arithmetic
 * on these fields downstream.
 */
function nullableNumber() {
  return z.preprocess((v) => {
    if (v === '' || v === null || v === undefined) return null
    if (typeof v === 'number' && Number.isNaN(v)) return null
    return v
  }, z.number().nullable()) as unknown as z.ZodNullable<z.ZodNumber>
}

export const poLineItemSchema = z.object({
  line_number: z.number().int().positive(),
  description: z.string().min(1, 'Description is required'),
  part_number: z.string().nullable(),
  quantity_ordered: z.number().int().positive('Quantity must be positive'),
  unit_price: nullableNumber(),
  notes: z.string().nullable(),
})

export const poFormSchema = z
  .object({
    po_number: z.string().min(1, 'PO number is required'),
    vendor_id: z.number().int().positive('Vendor is required'),
    project_id: z.number().int().positive('Project is required'),
    po_date: z.string().nullable(),
    pricing_mode: z.enum(['per_line', 'lump_sum']),
    lump_sum_amount: nullableNumber(),
    lines: z.array(poLineItemSchema).min(1, 'At least one line item is required'),
    notes: z.string().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.pricing_mode === 'lump_sum') {
      if (data.lump_sum_amount != null && data.lump_sum_amount <= 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['lump_sum_amount'],
          message: 'Lump sum must be greater than zero',
        })
      }
    }
  })
  .transform((data) => {
    if (data.pricing_mode === 'lump_sum') {
      return {
        ...data,
        lines: data.lines.map((line) => ({ ...line, unit_price: null })),
      }
    }
    return {
      ...data,
      lump_sum_amount: null,
    }
  })

export type POFormSchema = z.input<typeof poFormSchema>
export type POFormOutput = z.output<typeof poFormSchema>
export type POLineItemSchema = z.infer<typeof poLineItemSchema>
