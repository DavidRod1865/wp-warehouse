/**
 * deliverySchema.ts — Zod validation for the delivery form
 *
 * This is the single source of truth for what a valid delivery looks like.
 * Used by React Hook Form's zodResolver to validate on submit.
 *
 * Note: We avoid .default() here because it causes Zod input/output type
 * divergence that breaks React Hook Form's resolver typing. Defaults are
 * handled via useForm({ defaultValues }) instead.
 */
import { z } from 'zod'

const addressSchema = z.object({
  company_name: z.string(),
  street_address: z.string().min(1, 'Street address is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  zip_code: z.string().min(1, 'Zip code is required'),
  phone: z.string(),
})

const deliveryItemSchema = z.object({
  sortly_item_id: z.number().nullable(),
  item_name: z.string().min(1, 'Item name is required'),
  quantity: z.number().min(1, 'Quantity must be at least 1'),
  delivered_quantity: z.number(),
  remaining_quantity: z.number(),
  available_quantity: z.number().optional(),
  location: z.string().optional(),
  original_quantity: z.number().optional(),
  is_manual: z.boolean().optional(),
  notes: z.string().nullable(),
  custom_attribute_values: z.array(z.object({
    custom_attribute_id: z.number(),
    custom_attribute_name: z.string(),
    value: z.string(),
  })).nullable().optional(),
})

export const deliverySchema = z.object({
  delivery_number: z.string().min(1, 'Delivery number is required'),
  po_reference: z.string(),
  project_id: z.number().nullable(),
  truck_folder_id: z.number().nullable(),
  from_location_id: z.number().nullable(),
  from_address: addressSchema,
  to_address: addressSchema,
  items: z.array(deliveryItemSchema).min(1, 'At least one item is required'),
  driver_id: z.string().nullable(),
  status: z.enum(['draft', 'pending', 'in_transit', 'delivered', 'cancelled']),
}).superRefine((data, ctx) => {
  if (data.truck_folder_id === null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Please select a truck',
      path: ['truck_folder_id'],
    })
  }
  if (data.from_location_id === null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Please select a source location',
      path: ['from_location_id'],
    })
  }
})

export type DeliveryFormValues = z.infer<typeof deliverySchema>
export type DeliveryItemFormValues = z.infer<typeof deliveryItemSchema>
