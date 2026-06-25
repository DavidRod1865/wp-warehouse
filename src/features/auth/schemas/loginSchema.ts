import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

export type LoginFormData = z.infer<typeof loginSchema>

export const driverPinSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  pin: z.string().length(4, 'PIN must be 4 digits').regex(/^\d{4}$/, 'PIN must be 4 digits'),
})

export type DriverPinFormData = z.infer<typeof driverPinSchema>

export const driverPasswordSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
})

export type DriverPasswordFormData = z.infer<typeof driverPasswordSchema>
