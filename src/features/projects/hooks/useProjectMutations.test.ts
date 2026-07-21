import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { createMockSupabaseClient } from '../../../test/mockSupabase'
import { createTestQueryClient, createQueryWrapper } from '../../../test/queryWrapper'

const mockClient = vi.hoisted(() => {
  return { current: null as unknown as ReturnType<typeof import('../../../test/mockSupabase').createMockSupabaseClient> }
})

vi.mock('../../../lib/supabase', () => ({
  get supabase() {
    return mockClient.current
  },
}))

import { useCreateProject, useUpdateProject } from './useProjectMutations'
import { projectKeys } from './projectKeys'
import { inventoryKeys } from '../../inventory/hooks/inventoryKeys'
import type { ProjectFormValues } from '../schemas/projectSchema'

const baseValues: ProjectFormValues = {
  name: 'Test Project',
  gc_id: 1,
  project_address: {
    street_address: '123 Main St',
    city: 'Springfield',
    state: 'IL',
    zip_code: '62704',
  },
  status: 'active',
  notes: 'Some notes',
}

describe('useProjectMutations', () => {
  beforeEach(() => {
    mockClient.current = createMockSupabaseClient()
  })

  describe('useCreateProject', () => {
    it('inserts the project then calls ensure_project_locations with the new id', async () => {
      mockClient.current.queueTableResult('projects', {
        data: { id: 42, name: 'Test Project' },
        error: null,
      })
      mockClient.current.rpc.mockResolvedValueOnce({
        data: { success: true, job_site_location_id: 1, rigging_yard_location_id: 2, warehouse_location_id: 3 },
        error: null,
      })

      const queryClient = createTestQueryClient()
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
      const wrapper = createQueryWrapper(queryClient)

      const { result } = renderHook(() => useCreateProject(), { wrapper })

      const project = await result.current.mutateAsync(baseValues)

      expect(project).toEqual({ id: 42, name: 'Test Project' })
      expect(mockClient.current.rpc).toHaveBeenCalledWith('ensure_project_locations', {
        p_project_id: 42,
      })

      await waitFor(() => {
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: projectKeys.all })
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: inventoryKeys.locations() })
      })
    })

    it('throws when ensure_project_locations returns an error', async () => {
      mockClient.current.queueTableResult('projects', {
        data: { id: 42, name: 'Test Project' },
        error: null,
      })
      mockClient.current.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'boom' },
      })

      const wrapper = createQueryWrapper()
      const { result } = renderHook(() => useCreateProject(), { wrapper })

      await expect(result.current.mutateAsync(baseValues)).rejects.toBeTruthy()
    })

    it('throws when ensure_project_locations returns success: false', async () => {
      mockClient.current.queueTableResult('projects', {
        data: { id: 42, name: 'Test Project' },
        error: null,
      })
      mockClient.current.rpc.mockResolvedValueOnce({
        data: { success: false },
        error: null,
      })

      const wrapper = createQueryWrapper()
      const { result } = renderHook(() => useCreateProject(), { wrapper })

      await expect(result.current.mutateAsync(baseValues)).rejects.toThrow(
        'Failed to sync project locations'
      )
    })
  })

  describe('useUpdateProject', () => {
    it('calls ensure_project_locations even for a status-only update', async () => {
      mockClient.current.queueTableResult('projects', {
        data: { id: 7, name: 'Existing Project', status: 'on_hold' },
        error: null,
      })
      mockClient.current.rpc.mockResolvedValueOnce({
        data: { success: true, job_site_location_id: 1, rigging_yard_location_id: 2, warehouse_location_id: 3 },
        error: null,
      })

      const queryClient = createTestQueryClient()
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
      const wrapper = createQueryWrapper(queryClient)

      const { result } = renderHook(() => useUpdateProject(), { wrapper })

      await result.current.mutateAsync({ id: 7, values: { status: 'on_hold' } })

      expect(mockClient.current.rpc).toHaveBeenCalledWith('ensure_project_locations', {
        p_project_id: 7,
      })

      await waitFor(() => {
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: projectKeys.all })
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: projectKeys.detail(7) })
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: inventoryKeys.locations() })
      })
    })

    it('propagates an ensure_project_locations RPC error', async () => {
      mockClient.current.queueTableResult('projects', {
        data: { id: 7, name: 'Existing Project', status: 'on_hold' },
        error: null,
      })
      mockClient.current.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: 'boom' },
      })

      const wrapper = createQueryWrapper()
      const { result } = renderHook(() => useUpdateProject(), { wrapper })

      await expect(
        result.current.mutateAsync({ id: 7, values: { status: 'on_hold' } })
      ).rejects.toBeTruthy()
    })
  })
})
