/**
 * DriverLoginPage — Driver login with PIN or password
 *
 * Two modes:
 * 1. PIN login (4-digit code via Edge Function)
 * 2. Password login (standard Supabase auth with driver's email)
 */
import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../../../lib/supabase'
import {
  driverPinSchema,
  driverPasswordSchema,
  type DriverPinFormData,
  type DriverPasswordFormData,
} from '../schemas/loginSchema'

export default function DriverLoginPage() {
  const { user, profile, isLoading } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'pin' | 'password'>('pin')

  // Already logged in — redirect
  if (!isLoading && user && profile) {
    return <Navigate to={profile.role === 'driver' ? '/driver/deliveries' : '/'} replace />
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span className="loading loading-spinner loading-lg" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200 px-4">
      <div className="card w-full max-w-sm bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title text-2xl font-[Barlow_Semi_Condensed] justify-center mb-4">
            Driver Login
          </h2>

          {/* Tab toggle */}
          <div className="tabs tabs-boxed mb-4">
            <button
              className={`tab flex-1 ${mode === 'pin' ? 'tab-active' : ''}`}
              onClick={() => setMode('pin')}
            >
              PIN
            </button>
            <button
              className={`tab flex-1 ${mode === 'password' ? 'tab-active' : ''}`}
              onClick={() => setMode('password')}
            >
              Password
            </button>
          </div>

          {mode === 'pin' ? (
            <PinLoginForm navigate={navigate} />
          ) : (
            <PasswordLoginForm navigate={navigate} />
          )}

          <div className="divider text-xs">MANAGERS</div>
          <button
            className="btn btn-outline btn-sm w-full"
            onClick={() => navigate('/login')}
          >
            Manager Login
          </button>
        </div>
      </div>
    </div>
  )
}

function PinLoginForm({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  const { signIn } = useAuth()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<DriverPinFormData>({
    resolver: zodResolver(driverPinSchema),
  })

  const onSubmit = async (data: DriverPinFormData) => {
    try {
      // Verify PIN via Edge Function
      const { data: result, error } = await supabase.functions.invoke('verify-driver-pin', {
        body: { username: data.username, pin: data.pin },
      })

      if (error || !result?.email || !result?.tempPassword) {
        throw new Error(
          typeof result?.error === 'string' ? result.error : 'Invalid PIN'
        )
      }

      // Sign in with the temporary credentials returned by the Edge Function
      await signIn(result.email, result.tempPassword)
      navigate('/driver/deliveries')
    } catch (err) {
      setError('root', {
        message: err instanceof Error ? err.message : 'Login failed',
      })
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {errors.root && (
        <div className="alert alert-error mb-4 text-sm">
          <span>{errors.root.message}</span>
        </div>
      )}

      <div className="form-control mb-3">
        <input
          {...register('username')}
          className={`input input-bordered w-full ${errors.username ? 'input-error' : ''}`}
          placeholder="Username"
        />
        {errors.username && (
          <label className="label"><span className="label-text-alt text-error">{errors.username.message}</span></label>
        )}
      </div>

      <div className="form-control mb-6">
        <input
          {...register('pin')}
          type="password"
          inputMode="numeric"
          maxLength={4}
          className={`input input-bordered w-full text-center text-2xl tracking-[0.5em] ${errors.pin ? 'input-error' : ''}`}
          placeholder="• • • •"
        />
        {errors.pin && (
          <label className="label"><span className="label-text-alt text-error">{errors.pin.message}</span></label>
        )}
      </div>

      <button type="submit" className="btn btn-primary w-full" disabled={isSubmitting}>
        {isSubmitting ? <span className="loading loading-spinner loading-sm" /> : 'Sign In with PIN'}
      </button>
    </form>
  )
}

function PasswordLoginForm({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  const { signIn } = useAuth()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<DriverPasswordFormData>({
    resolver: zodResolver(driverPasswordSchema),
  })

  const onSubmit = async (data: DriverPasswordFormData) => {
    try {
      // Drivers use username@drivers.wpwarehouse.local as their email
      const email = data.username.includes('@')
        ? data.username
        : `${data.username}@drivers.wpwarehouse.local`

      await signIn(email, data.password)
      navigate('/driver/deliveries')
    } catch (err) {
      setError('root', {
        message: err instanceof Error ? err.message : 'Login failed',
      })
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {errors.root && (
        <div className="alert alert-error mb-4 text-sm">
          <span>{errors.root.message}</span>
        </div>
      )}

      <div className="form-control mb-3">
        <input
          {...register('username')}
          className={`input input-bordered w-full ${errors.username ? 'input-error' : ''}`}
          placeholder="Username"
        />
      </div>

      <div className="form-control mb-6">
        <input
          {...register('password')}
          type="password"
          className={`input input-bordered w-full ${errors.password ? 'input-error' : ''}`}
          placeholder="Password"
        />
      </div>

      <button type="submit" className="btn btn-primary w-full" disabled={isSubmitting}>
        {isSubmitting ? <span className="loading loading-spinner loading-sm" /> : 'Sign In'}
      </button>
    </form>
  )
}
