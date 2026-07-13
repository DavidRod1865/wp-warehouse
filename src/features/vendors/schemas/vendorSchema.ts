/**
 * vendorSchema — Zod validation for the vendor form
 */
import { z } from 'zod'

const addressSchema = z.object({
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  notes: z.string().optional(),
}).optional()

export const vendorFormSchema = z.object({
  name: z.string().min(1, 'Vendor name is required'),
  contact_name: z.string().optional(),
  phone: z.string().optional(),
  email: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || z.string().email().safeParse(v).success, 'Valid email required'),
  address: addressSchema,
  notes: z.string().optional(),
  is_active: z.boolean(),
})

export type VendorFormValues = {
  name: string
  contact_name?: string
  phone?: string
  email?: string
  address?: { street?: string; city?: string; state?: string; zip?: string; notes?: string }
  notes?: string
  is_active: boolean
}
