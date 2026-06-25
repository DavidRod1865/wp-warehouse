/**
 * supabase.ts — Single Supabase client
 *
 * The rebuild uses ONE client. Driver account creation is handled
 * via an Edge Function using the admin API (service role key),
 * eliminating the need for a second non-persisting client.
 */
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
