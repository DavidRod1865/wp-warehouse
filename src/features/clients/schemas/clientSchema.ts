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
  email: z.string().email('Valid email required').optional(),
  billing_address: billingAddressSchema,
  notes: z.string().optional(),
})

export type ClientFormValues = {
  company_name: string
  contact_name?: string
  phone?: string
  email?: string
  billing_address?: { street?: string; city?: string; state?: string; zip?: string; notes?: string }
  notes?: string
}
