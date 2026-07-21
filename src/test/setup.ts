/**
 * Vitest global setup — runs before every test file.
 *
 * Stubs the Supabase env vars BEFORE anything imports src/lib/supabase.ts,
 * since createClient() throws if the URL/key are missing or malformed.
 */
import { vi } from 'vitest'

vi.stubEnv('VITE_SUPABASE_URL', 'https://test-project.supabase.co')
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key')

import '@testing-library/jest-dom/vitest'
