/**
 * LoginPage — Manager/Admin login
 *
 * Uses React Hook Form + Zod for form validation.
 * Redirects to dashboard on successful auth.
 */
import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '../hooks/useAuth'
import { loginSchema, type LoginFormData } from '../schemas/loginSchema'

export default function LoginPage() {
  const { user, profile, isLoading, signIn, resetPassword } = useAuth()
  const navigate = useNavigate()
  const [showReset, setShowReset] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  })

  // Already logged in — redirect
  if (!isLoading && user && profile) {
    return <Navigate to={profile.role === 'driver' ? '/driver/deliveries' : '/'} replace />
  }

  const onSubmit = async (data: LoginFormData) => {
    try {
      await signIn(data.email, data.password)
      navigate('/')
    } catch (err) {
      setError('root', {
        message: err instanceof Error ? err.message : 'Login failed. Please try again.',
      })
    }
  }

  const handleResetPassword = async (email: string) => {
    try {
      await resetPassword(email)
      setResetSent(true)
    } catch {
      // Still show success to prevent email enumeration
      setResetSent(true)
    }
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
      <div className="card w-full max-w-md bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title text-2xl font-[Barlow_Semi_Condensed] justify-center mb-4">
            WP Warehouse
          </h2>

          {showReset ? (
            // Password reset form
            <div>
              <p className="text-sm text-base-content/60 mb-4">
                {resetSent
                  ? 'If an account exists with that email, you will receive a reset link.'
                  : 'Enter your email to receive a password reset link.'}
              </p>
              {!resetSent && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    const email = new FormData(e.currentTarget).get('email') as string
                    handleResetPassword(email)
                  }}
                >
                  <div className="form-control mb-4">
                    <input
                      type="email"
                      name="email"
                      placeholder="Email"
                      className="input input-bordered w-full"
                      required
                    />
                  </div>
                  <button type="submit" className="btn btn-primary w-full">
                    Send Reset Link
                  </button>
                </form>
              )}
              <button
                className="btn btn-ghost btn-sm mt-4 w-full"
                onClick={() => { setShowReset(false); setResetSent(false) }}
              >
                Back to Login
              </button>
            </div>
          ) : (
            // Login form
            <form onSubmit={handleSubmit(onSubmit)}>
              {errors.root && (
                <div className="alert alert-error mb-4">
                  <span>{errors.root.message}</span>
                </div>
              )}

              <div className="form-control mb-3">
                <label className="label"><span className="label-text">Email</span></label>
                <input
                  type="email"
                  {...register('email')}
                  className={`input input-bordered w-full ${errors.email ? 'input-error' : ''}`}
                  placeholder="you@example.com"
                />
                {errors.email && (
                  <label className="label"><span className="label-text-alt text-error">{errors.email.message}</span></label>
                )}
              </div>

              <div className="form-control mb-6">
                <label className="label"><span className="label-text">Password</span></label>
                <input
                  type="password"
                  {...register('password')}
                  className={`input input-bordered w-full ${errors.password ? 'input-error' : ''}`}
                  placeholder="••••••••"
                />
                {errors.password && (
                  <label className="label"><span className="label-text-alt text-error">{errors.password.message}</span></label>
                )}
              </div>

              <button
                type="submit"
                className="btn btn-primary w-full"
                disabled={isSubmitting}
              >
                {isSubmitting ? <span className="loading loading-spinner loading-sm" /> : 'Sign In'}
              </button>

              <button
                type="button"
                className="btn btn-ghost btn-sm mt-3 w-full"
                onClick={() => setShowReset(true)}
              >
                Forgot Password?
              </button>
            </form>
          )}

          <div className="divider text-xs">DRIVERS</div>
          <button
            className="btn btn-outline btn-sm w-full"
            onClick={() => navigate('/driver/login')}
          >
            Driver Login
          </button>
        </div>
      </div>
    </div>
  )
}
