export type UserRole = 'warehouse_manager' | 'driver' | 'apm' | 'admin'

export interface UserProfile {
  id: string
  email: string | null
  name?: string | null
  username?: string | null
  role: UserRole
  force_pin_change?: boolean | null
  active: boolean
}
