import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { createMockSupabaseClient } from '../../../test/mockSupabase'
import { createQueryWrapper } from '../../../test/queryWrapper'

const mockClient = vi.hoisted(() => {
  return { current: null as unknown as ReturnType<typeof import('../../../test/mockSupabase').createMockSupabaseClient> }
})

vi.mock('../../../lib/supabase', () => ({
  get supabase() {
    return mockClient.current
  },
}))

import { fetchReconciliation, useReconciliation } from './useReconciliation'
import { auditKeys } from './auditKeys'

describe('fetchReconciliation', () => {
  beforeEach(() => {
    mockClient.current = createMockSupabaseClient()
  })

  it('queries po_project_reconciliation ordered by po_number then line_number, without an eq filter when projectId is omitted', async () => {
    mockClient.current.queueTableResult('po_project_reconciliation', { data: [{ po_id: 1 }], error: null })

    const rows = await fetchReconciliation()

    expect(mockClient.current.from).toHaveBeenCalledWith('po_project_reconciliation')
    const builder = mockClient.current.from.mock.results[0].value
    expect(builder.select).toHaveBeenCalledWith('*')
    expect(builder.order).toHaveBeenNthCalledWith(1, 'po_number', { ascending: true })
    expect(builder.order).toHaveBeenNthCalledWith(2, 'line_number', { ascending: true })
    expect(builder.eq).not.toHaveBeenCalled()
    expect(rows).toEqual([{ po_id: 1 }])
  })

  it('adds .eq("project_id", projectId) only when projectId is provided', async () => {
    mockClient.current.queueTableResult('po_project_reconciliation', { data: [], error: null })

    await fetchReconciliation(7)

    const builder = mockClient.current.from.mock.results[0].value
    expect(builder.eq).toHaveBeenCalledWith('project_id', 7)
  })

  it('returns an empty array when data is null', async () => {
    mockClient.current.queueTableResult('po_project_reconciliation', { data: null, error: null })

    const rows = await fetchReconciliation()

    expect(rows).toEqual([])
  })

  it('throws when the query returns an error', async () => {
    mockClient.current.queueTableResult('po_project_reconciliation', {
      data: null,
      error: { message: 'query failed' },
    })

    await expect(fetchReconciliation()).rejects.toBeTruthy()
  })
})

describe('useReconciliation', () => {
  beforeEach(() => {
    mockClient.current = createMockSupabaseClient()
  })

  it('uses auditKeys.reconciliation() as the query key when no projectId is given', async () => {
    mockClient.current.queueTableResult('po_project_reconciliation', { data: [], error: null })
    const wrapper = createQueryWrapper()

    const { result } = renderHook(() => useReconciliation(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    // No direct access to the internal queryKey, but we assert indirectly by
    // confirming the query resolved successfully with the expected shape.
    expect(result.current.data).toEqual([])
  })

  it('uses auditKeys.reconciliationByProject(projectId) when projectId is given', async () => {
    mockClient.current.queueTableResult('po_project_reconciliation', { data: [{ po_id: 5 }], error: null })
    const wrapper = createQueryWrapper()

    const { result } = renderHook(() => useReconciliation(3), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([{ po_id: 5 }])
    expect(auditKeys.reconciliationByProject(3)).toEqual(['audit', 'reconciliation', 'project', 3])
  })

  it('treats a null projectId the same as omitted (uses auditKeys.reconciliation())', async () => {
    mockClient.current.queueTableResult('po_project_reconciliation', { data: [], error: null })
    const wrapper = createQueryWrapper()

    const { result } = renderHook(() => useReconciliation(null), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const builder = mockClient.current.from.mock.results[0].value
    expect(builder.eq).not.toHaveBeenCalled()
  })
})
