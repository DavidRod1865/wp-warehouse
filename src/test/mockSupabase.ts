/**
 * mockSupabase.ts — shared chainable Supabase client mock for hook tests.
 *
 * Usage:
 *   const client = createMockSupabaseClient()
 *   client.queueTableResult('receiving_logs', { data: { id: 1 }, error: null })
 *   vi.mock('../../../lib/supabase', () => ({ supabase: client }))
 *
 * Each call to `.from(table)` returns a fresh chainable builder. Query
 * builder methods (select/eq/order/insert/update/...) all return the same
 * builder so calls can be chained in any order, matching how the
 * postgrest-js query builder behaves. The builder resolves (via `.then`,
 * `.single()`, or `.maybeSingle()`) to the next queued result for that
 * table, or a default `{ data: null, error: null }` if nothing was queued.
 */
import { vi } from 'vitest'

export interface MockResult<T = unknown> {
  data: T | null
  error: { message: string } | null
}

const CHAINABLE_METHODS = [
  'select',
  'insert',
  'update',
  'upsert',
  'delete',
  'eq',
  'neq',
  'order',
  'limit',
  'match',
  'in',
  'filter',
  'gt',
  'gte',
  'lt',
  'lte',
  'is',
  'not',
  'contains',
] as const

function createChainableBuilder(getResult: () => MockResult) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder: any = {}

  for (const method of CHAINABLE_METHODS) {
    builder[method] = vi.fn(() => builder)
  }

  builder.maybeSingle = vi.fn(() => Promise.resolve(getResult()))
  builder.single = vi.fn(() => Promise.resolve(getResult()))
  // Makes the builder itself awaitable when no terminal method is called,
  // e.g. `const { data, error } = await supabase.from(x).select().order()`.
  builder.then = (
    onFulfilled?: (value: MockResult) => unknown,
    onRejected?: (reason: unknown) => unknown,
  ) => Promise.resolve(getResult()).then(onFulfilled, onRejected)
  builder.catch = (onRejected: (reason: unknown) => unknown) =>
    Promise.resolve(getResult()).catch(onRejected)

  return builder
}

export function createMockSupabaseClient() {
  const tableQueues = new Map<string, MockResult[]>()
  const defaultResult: MockResult = { data: null, error: null }

  /** Queue the next result returned for `.from(table)`'s eventual resolution. */
  function queueTableResult(table: string, result: MockResult) {
    const queue = tableQueues.get(table) ?? []
    queue.push(result)
    tableQueues.set(table, queue)
  }

  const from = vi.fn((table: string) => {
    return createChainableBuilder(() => {
      const queue = tableQueues.get(table)
      if (queue && queue.length > 0) {
        return queue.shift()!
      }
      return defaultResult
    })
  })

  const rpc = vi.fn().mockResolvedValue({ data: null, error: null })

  const upload = vi.fn().mockResolvedValue({ data: { path: 'mock/path.png' }, error: null })
  const createSignedUrl = vi
    .fn()
    .mockResolvedValue({ data: { signedUrl: 'https://signed.example/mock' }, error: null })
  const storageFrom = vi.fn(() => ({ upload, createSignedUrl }))

  const getUser = vi
    .fn()
    .mockResolvedValue({ data: { user: { id: 'user-1', email: 'user@example.com' } }, error: null })

  return {
    from,
    rpc,
    storage: { from: storageFrom },
    auth: { getUser },
    queueTableResult,
    _mocks: { upload, createSignedUrl, storageFrom, getUser },
  }
}

export type MockSupabaseClient = ReturnType<typeof createMockSupabaseClient>
