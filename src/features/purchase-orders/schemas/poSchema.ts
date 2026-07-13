import { z } from 'zod'

export const poLineItemSchema = z.object({
  line_number: z.number().int().positive(),
  description: z.string().min(1, 'Description is required'),
  part_number: z.string().nullable(),
  quantity_ordered: z.number().int().positive('Quantity must be positive'),
  unit_price: z.number().nullable(),
  notes: z.string().nullable(),
})

export const poFormSchema = z.object({
  po_number: z.string().min(1, 'PO number is required'),
  vendor_id: z.number().int().positive('Vendor is required'),
  project_id: z.number().int().positive('Project is required'),
  po_date: z.string().datetime().nullable(),
  lines: z.array(poLineItemSchema).min(1, 'At least one line item is required'),
  notes: z.string().nullable(),
})

export type POFormSchema = z.infer<typeof poFormSchema>
export type POLineItemSchema = z.infer<typeof poLineItemSchema>
