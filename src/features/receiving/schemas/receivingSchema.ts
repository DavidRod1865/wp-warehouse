/**
 * receivingSchema — Zod validation for the receiving form
 *
 * No .default() — defaults handled via useForm({ defaultValues }).
 */
import { z } from 'zod'

export const receivingItemSchema = z.object({
  tempId: z.string(),
  item_name: z.string().min(1, 'Item name is required'),
  part_number: z.string().nullable(),
  quantity_ordered: z.number().min(0),
  quantity_shipped: z.number().min(1, 'Must ship at least 1'),
  back_order: z.number().min(0),
  quantity_received: z.number().min(1, 'Must receive at least 1'),
  confidence: z.enum(['high', 'low']),
  action: z.enum(['pending', 'update', 'create', 'skip']),
  sortly_item_id: z.number().nullable(),
  sortly_current_quantity: z.number().nullable(),
  destination_folder_id: z.number().nullable(),
  destination_folder_name: z.string().nullable(),
  notes: z.string().nullable(),
  tags: z.array(z.string()),
})

export const receivingSchema = z.object({
  vendor: z.string().min(1, 'Vendor is required'),
  po_number: z.string().nullable(),
  date_received: z.string().min(1, 'Date received is required'),
  destination_type: z.enum(['project', 'warehouse']),
  destination_folder_id: z.number().nullable(),
  project_id: z.number().nullable(),
  project_name: z.string().nullable(),
  notes: z.string().nullable(),
  items: z.array(receivingItemSchema).min(1, 'At least one item is required'),
}).superRefine((data, ctx) => {
  if (data.destination_folder_id === null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: data.destination_type === 'project'
        ? 'Please select a project'
        : 'Please select a destination folder',
      path: ['destination_folder_id'],
    })
  }
})

export type ReceivingFormValues = z.infer<typeof receivingSchema>
export type ReceivingItemFormValues = z.infer<typeof receivingItemSchema>
