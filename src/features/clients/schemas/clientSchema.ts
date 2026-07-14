/**
 * clientSchema — Zod validation for the client form
 */
import { z } from 'zod'

const billingAddressSchema = z.object({
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  notes: z.string().optional(),
}).optional()

export const clientFormSchema = z.object({
  company_name: z.string().min(1, 'Company name is required'),
  contact_name: z.string().optional(),
  phone: z.string().optional(),
  email: z
    .string()
    .trim()
    .optional()
    .refine((v) => !v || z.string().email().safeParse(v).success, 'Valid email required'),
  billing_address: billingAddressSchema,
  notes: z.string().optional(),
  is_active: z.boolean(),
})

export type ClientFormValues = {
  company_name: string
  contact_name?: string
  phone?: string
  email?: string
  billing_address?: { street?: string; city?: string; state?: string; zip?: string; notes?: string }
  notes?: string
  is_active: boolean
}
