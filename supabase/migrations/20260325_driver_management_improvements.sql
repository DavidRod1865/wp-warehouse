-- Driver Management Improvements: PIN-based login support
-- Adds columns for server-side PIN authentication flow

-- Random password used by Edge Function to sign in on the driver's behalf.
-- Never exposed to the client — only the resulting JWT is returned.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS internal_auth_token TEXT;

-- When true, the driver is forced to set a new PIN on next login.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS force_pin_change BOOLEAN NOT NULL DEFAULT false;

-- Brute-force protection: track consecutive failed PIN attempts.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS pin_failed_attempts INTEGER NOT NULL DEFAULT 0;

-- Lockout timestamp: if set and in the future, PIN login is blocked.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS pin_locked_until TIMESTAMPTZ;
