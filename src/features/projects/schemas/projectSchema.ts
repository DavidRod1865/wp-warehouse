/**
 * projectSchema — Zod validation for the project form
 */
import { z } from 'zod'

const projectAddressSchema = z.object({
  street_address: z.string().min(1, 'Street address is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  zip_code: z.string().min(1, 'Zip code is required'),
  phone: z.string().optional(),
})

export const projectFormSchema = z.object({
  name: z.string().min(1, 'Project name is required'),
  // preprocess turns NaN from valueAsNumber inputs into undefined; the cast
  // restores a typed input (z.preprocess otherwise types input as unknown,
  // which breaks zodResolver's inferred form types)
  gc_id: z.preprocess(
    (v) => (typeof v === 'number' && Number.isNaN(v) ? undefined : v),
    z.number().optional(),
  ) as unknown as z.ZodOptional<z.ZodNumber>,
  project_address: projectAddressSchema,
  status: z.string().optional(),
  notes: z.string().optional(),
})

export type ProjectFormValues = {
  name: string
  gc_id?: number
  project_address: { street_address: string; city: string; state: string; zip_code: string; phone?: string }
  status?: string
  notes?: string
}
