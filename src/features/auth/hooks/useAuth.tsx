/* eslint-disable react-refresh/only-export-components */
/**
 * useAuth — Authentication hook powered by Supabase + TanStack Query
 *
 * Replaces the old AuthContext pattern. Key improvements:
 * - Profile fetching uses TanStack Query (automatic caching, retry, refetch)
 * - No more manual realtimeUpdateCounter — realtime events invalidate specific query keys
 * - Single Supabase client (driver creation via Edge Function)
 *
 * Usage:
 *   const { user, profile, isLoading, signIn, signOut } = useAuth()
 */
import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase'
import type { User, RealtimeChannel } from '@supabase/supabase-js'
import type { UserProfile } from '../types'

interface AuthContextValue {
  user: User | null
  profile: UserProfile | null
  isLoading: boolean
  profileError: string | null
  mfaEnabled: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  updateProfileName: (name: string) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

import { authKeys } from './authKeys'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [initializing, setInitializing] = useState(true)
  const [mfaEnabled, setMfaEnabled] = useState(false)
  const queryClient = useQueryClient()

  // ── Session management ──
  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setUser(session?.user ?? null)
      })
      .catch(() => {
        setUser(null)
      })
      .finally(() => {
        setInitializing(false)
      })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  // ── Profile query (replaces manual fetchProfile + useState) ──
  const {
    data: profile,
    error: profileQueryError,
    isLoading: profileLoading,
  } = useQuery({
    queryKey: user ? authKeys.profile(user.id) : ['auth', 'profile', 'none'],
    queryFn: async () => {
      if (!user) return null
      const { data, error } = await supabase
        .from('users')
        .select('id, email, name, username, role, active, force_pin_change')
        .eq('id', user.id)
        .single()

      if (error) throw error
      return data as UserProfile
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  })

  // ── MFA check (non-blocking) ──
  useEffect(() => {
    if (!user) return
    supabase.auth.mfa.listFactors().then(({ data: factors }) => {
      setMfaEnabled((factors?.totp ?? []).some((f) => f.status === 'verified'))
    }).catch(() => { /* non-critical */ })
  }, [user])

  // ── Realtime subscriptions (targeted query invalidation) ──
  useEffect(() => {
    if (!user) return

    const channels: RealtimeChannel[] = []

    // Deliveries table changes → invalidate delivery queries
    channels.push(
      supabase
        .channel('deliveries-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'deliveries' }, () => {
          queryClient.invalidateQueries({ queryKey: ['deliveries'] })
        })
        .subscribe()
    )

    // Delivery items changes → invalidate delivery queries
    channels.push(
      supabase
        .channel('delivery-items-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_items' }, () => {
          queryClient.invalidateQueries({ queryKey: ['deliveries'] })
        })
        .subscribe()
    )

    // Notifications for current user
    channels.push(
      supabase
        .channel('notifications-changes')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        }, () => {
          queryClient.invalidateQueries({ queryKey: ['notifications'] })
        })
        .subscribe()
    )

    return () => {
      channels.forEach((ch) => supabase.removeChannel(ch))
    }
  }, [user, queryClient])

  // ── Auth mutations ──
  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }, [])

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    queryClient.clear()
  }, [queryClient])

  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) throw error
  }, [])

  const updateProfileNameMutation = useMutation({
    mutationFn: async (name: string) => {
      if (!user) throw new Error('No authenticated user')
      const trimmed = name.trim()
      const nextName = trimmed.length > 0 ? trimmed : null
      const { error } = await supabase
        .from('users')
        .update({ name: nextName })
        .eq('id', user.id)
      if (error) throw error
    },
    onSuccess: () => {
      if (user) {
        queryClient.invalidateQueries({ queryKey: authKeys.profile(user.id) })
      }
    },
  })

  const updateProfileName = useCallback(
    (name: string) => updateProfileNameMutation.mutateAsync(name),
    [updateProfileNameMutation]
  )

  const isLoading = initializing || (!!user && profileLoading)
  const profileError = profileQueryError ? 'Unable to load your profile. Please try again.' : null

  return (
    <AuthContext.Provider
      value={{
        user,
        profile: profile ?? null,
        isLoading,
        profileError,
        mfaEnabled,
        signIn,
        signOut,
        resetPassword,
        updateProfileName,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
