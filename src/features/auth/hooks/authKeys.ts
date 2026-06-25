/** Centralized query keys for auth-related TanStack queries */
export const authKeys = {
  profile: (userId: string) => ['auth', 'profile', userId] as const,
}
