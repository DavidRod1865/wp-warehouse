/**
 * DriverSettingsPage — /driver/settings
 *
 * Shows profile info and a Change PIN form.
 *
 * set-driver-pin Edge Function — driver self mode payload:
 *   { newPin: string, currentPin?: string }
 *   Authorization: Bearer <session token>
 *
 * currentPin is required unless force_pin_change is true.
 */
import { useState } from 'react'
import { useAuth } from '../../auth/hooks/useAuth'
import { supabase } from '../../../lib/supabase'

type PinStep = 'idle' | 'submitting' | 'success' | 'error'

export default function DriverSettingsPage() {
  const { user, profile, signOut } = useAuth()

  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [pinStep, setPinStep] = useState<PinStep>('idle')
  const [pinError, setPinError] = useState<string | null>(null)
  const [signingOut, setSigningOut] = useState(false)

  const forcePinChange = profile?.force_pin_change ?? false

  const handleChangePIN = async (e: React.FormEvent) => {
    e.preventDefault()
    setPinError(null)

    if (!/^\d{4,6}$/.test(newPin)) {
      setPinError('New PIN must be 4–6 digits.')
      return
    }

    if (newPin !== confirmPin) {
      setPinError('PINs do not match.')
      return
    }

    if (!forcePinChange && !currentPin) {
      setPinError('Please enter your current PIN.')
      return
    }

    setPinStep('submitting')

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) throw new Error('Not authenticated')

      const payload: { newPin: string; currentPin?: string } = { newPin }
      if (!forcePinChange && currentPin) {
        payload.currentPin = currentPin
      }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/set-driver-pin`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        }
      )

      const json = await res.json()

      if (!res.ok || !json.success) {
        throw new Error(json.error ?? 'Failed to change PIN')
      }

      setPinStep('success')
      setCurrentPin('')
      setNewPin('')
      setConfirmPin('')
    } catch (err) {
      setPinStep('error')
      setPinError(err instanceof Error ? err.message : 'An error occurred')
    }
  }

  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      await signOut()
    } catch {
      setSigningOut(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-lg mx-auto pb-8">
      <h1 className="text-2xl font-bold font-[Barlow_Semi_Condensed] pt-2">Settings</h1>

      {/* Profile card */}
      <div className="card bg-base-200">
        <div className="card-body p-4 gap-1">
          <h2 className="font-semibold text-base mb-2">Profile</h2>
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-base-content/60">Name</span>
              <span className="font-medium">{profile?.name ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-base-content/60">Username</span>
              <span className="font-medium">{profile?.username ?? '—'}</span>
            </div>
            {user?.email && (
              <div className="flex justify-between">
                <span className="text-base-content/60">Email</span>
                <span className="font-medium">{user.email}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Change PIN */}
      <div className="card bg-base-200">
        <div className="card-body p-4">
          <h2 className="font-semibold text-base mb-3">
            {forcePinChange ? (
              <span className="text-warning">PIN Change Required</span>
            ) : (
              'Change PIN'
            )}
          </h2>

          {forcePinChange && (
            <div className="alert alert-warning text-sm py-2 mb-3">
              <span>Your manager has reset your PIN. Please set a new one.</span>
            </div>
          )}

          {pinStep === 'success' && (
            <div className="alert alert-success text-sm py-2 mb-3">
              <span>PIN changed successfully.</span>
            </div>
          )}

          <form onSubmit={handleChangePIN} className="flex flex-col gap-4">
            {!forcePinChange && (
              <div className="form-control gap-1">
                <label className="label py-0">
                  <span className="label-text font-medium">Current PIN</span>
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="\d{4,6}"
                  maxLength={6}
                  className="input input-bordered text-lg tracking-widest"
                  placeholder="••••"
                  value={currentPin}
                  onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))}
                  autoComplete="current-password"
                />
              </div>
            )}

            <div className="form-control gap-1">
              <label className="label py-0">
                <span className="label-text font-medium">New PIN</span>
              </label>
              <input
                type="password"
                inputMode="numeric"
                pattern="\d{4,6}"
                maxLength={6}
                className="input input-bordered text-lg tracking-widest"
                placeholder="••••"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                autoComplete="new-password"
              />
              <p className="text-xs text-base-content/50 pl-1">4–6 digits</p>
            </div>

            <div className="form-control gap-1">
              <label className="label py-0">
                <span className="label-text font-medium">Confirm New PIN</span>
              </label>
              <input
                type="password"
                inputMode="numeric"
                pattern="\d{4,6}"
                maxLength={6}
                className="input input-bordered text-lg tracking-widest"
                placeholder="••••"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                autoComplete="new-password"
              />
            </div>

            {pinError && (
              <div className="alert alert-error text-sm py-2">
                <span>{pinError}</span>
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={pinStep === 'submitting'}
            >
              {pinStep === 'submitting' ? (
                <span className="loading loading-spinner" />
              ) : (
                'Save PIN'
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Sign out */}
      <div className="card bg-base-200">
        <div className="card-body p-4">
          <button
            type="button"
            className="btn btn-error btn-outline w-full"
            onClick={handleSignOut}
            disabled={signingOut}
          >
            {signingOut ? <span className="loading loading-spinner" /> : 'Sign Out'}
          </button>
        </div>
      </div>
    </div>
  )
}
