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

import { useCreateDelivery, useConfirmDelivery, useCancelDelivery } from './useDeliveryMutations'
import { deliveryKeys } from './deliveryKeys'
import { inventoryKeys } from '../../inventory/hooks/inventoryKeys'
import type { DeliveryFormValues } from '../schemas/deliverySchema'

function baseAddress() {
  return {
    company_name: 'WP Warehouse',
    street_address: '123 Main St',
    city: 'Anytown',
    state: 'NY',
    zip_code: '10001',
    phone: '',
  }
}

function baseFormValues(overrides: Partial<DeliveryFormValues> = {}): DeliveryFormValues {
  return {
    po_reference: '',
    project_id: 1,
    truck_location_id: 1,
    from_location_id: 2,
    from_address: baseAddress(),
    to_address: baseAddress(),
    items: [
      {
        item_id: 5,
        item_name: 'Widget',
        quantity: 3,
        delivered_quantity: 0,
        remaining_quantity: 3,
        notes: null,
      },
    ],
    driver_id: null,
    status: 'draft',
    delivery_type: 'commercial',
    ...overrides,
  }
}

describe('useDeliveryMutations', () => {
  beforeEach(() => {
    mockClient.current = createMockSupabaseClient()
  })

  describe('useCreateDelivery', () => {
    it('throws before calling the rpc when truck_location_id is missing', async () => {
      const wrapper = createQueryWrapper()
      const { result } = renderHook(() => useCreateDelivery(), { wrapper })

      await expect(
        result.current.mutateAsync({
          formValues: baseFormValues({ truck_location_id: null }),
          userId: 'u1',
          userEmail: 'u1@example.com',
        }),
      ).rejects.toThrow('Truck and source location are required')

      expect(mockClient.current.rpc).not.toHaveBeenCalled()
    })

    it('throws before calling the rpc when from_location_id is missing', async () => {
      const wrapper = createQueryWrapper()
      const { result } = renderHook(() => useCreateDelivery(), { wrapper })

      await expect(
        result.current.mutateAsync({
          formValues: baseFormValues({ from_location_id: null }),
          userId: 'u1',
          userEmail: 'u1@example.com',
        }),
      ).rejects.toThrow('Truck and source location are required')

      expect(mockClient.current.rpc).not.toHaveBeenCalled()
    })

    it('calls rpc("create_delivery") with the mapped payload on the happy path', async () => {
      mockClient.current.rpc.mockResolvedValueOnce({
        data: { success: true, delivery_id: 1, delivery_number: 'WP-072126-01' },
        error: null,
      })
      const queryClient = createTestQueryClient()
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
      const wrapper = createQueryWrapper(queryClient)
      const { result } = renderHook(() => useCreateDelivery(), { wrapper })

      const returned = await result.current.mutateAsync({
        formValues: baseFormValues(),
        userId: 'u1',
        userEmail: 'u1@example.com',
      })

      expect(mockClient.current.rpc).toHaveBeenCalledWith('create_delivery', {
        p: {
          project_id: 1,
          driver_id: null,
          truck_location_id: 1,
          from_location_id: 2,
          status: 'draft',
          from_address: baseAddress(),
          to_address: baseAddress(),
          po_reference: null,
          items: [
            { item_id: 5, item_name: 'Widget', quantity: 3, notes: null },
          ],
        },
      })
      expect(returned.delivery_id).toBe(1)

      await waitFor(() => {
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: deliveryKeys.all })
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: inventoryKeys.stockLevels() })
        expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: inventoryKeys.movements() })
      })
    })

    it('throws when the rpc resolves with an error', async () => {
      mockClient.current.rpc.mockResolvedValueOnce({ data: null, error: { message: 'db error' } })
      const wrapper = createQueryWrapper()
      const { result } = renderHook(() => useCreateDelivery(), { wrapper })

      await expect(
        result.current.mutateAsync({
          formValues: baseFormValues(),
          userId: 'u1',
          userEmail: 'u1@example.com',
        }),
      ).rejects.toBeTruthy()
    })

    it('throws when the rpc reports success: false', async () => {
      mockClient.current.rpc.mockResolvedValueOnce({ data: { success: false }, error: null })
      const wrapper = createQueryWrapper()
      const { result } = renderHook(() => useCreateDelivery(), { wrapper })

      await expect(
        result.current.mutateAsync({
          formValues: baseFormValues(),
          userId: 'u1',
          userEmail: 'u1@example.com',
        }),
      ).rejects.toThrow('create_delivery RPC returned unsuccessful')
    })
  })

  describe('useConfirmDelivery', () => {
    it('uploads the signature before calling the rpc, and matches the storage path', async () => {
      mockClient.current.rpc.mockResolvedValueOnce({
        data: { success: true, delivery_id: 1, items_moved: 1 },
        error: null,
      })
      const wrapper = createQueryWrapper()
      const { result } = renderHook(() => useConfirmDelivery(), { wrapper })

      const blob = new Blob(['fake-png'], { type: 'image/png' })

      await result.current.mutateAsync({
        deliveryId: 1,
        driverId: 'driver-1',
        signedByName: 'John Doe',
        signatureBlob: blob,
      })

      expect(mockClient.current.storage.from).toHaveBeenCalledWith('delivery-signatures-v2')
      expect(mockClient.current._mocks.upload).toHaveBeenCalledTimes(1)
      const [uploadedPath, uploadedBlob, uploadOpts] = mockClient.current._mocks.upload.mock.calls[0]
      expect(uploadedPath).toMatch(/^1\/driver-1\/\d+\.png$/)
      expect(uploadedBlob).toBe(blob)
      expect(uploadOpts).toEqual({ contentType: 'image/png', upsert: true })

      expect(mockClient.current.rpc).toHaveBeenCalledWith('confirm_delivery', {
        p_delivery_id: 1,
        p_signed_by_name: 'John Doe',
        p_signature_storage_path: uploadedPath,
        p_notes: null,
        p_delivered: null,
      })

      // Upload must happen before the rpc call.
      const uploadOrder = mockClient.current._mocks.upload.mock.invocationCallOrder[0]
      const rpcOrder = mockClient.current.rpc.mock.invocationCallOrder[0]
      expect(uploadOrder).toBeLessThan(rpcOrder)
    })

    it('passes a null signature_storage_path and skips upload when no signatureBlob is given', async () => {
      mockClient.current.rpc.mockResolvedValueOnce({
        data: { success: true, delivery_id: 1, items_moved: 0 },
        error: null,
      })
      const wrapper = createQueryWrapper()
      const { result } = renderHook(() => useConfirmDelivery(), { wrapper })

      await result.current.mutateAsync({
        deliveryId: 1,
        driverId: 'driver-1',
        signedByName: 'Jane Doe',
      })

      expect(mockClient.current._mocks.upload).not.toHaveBeenCalled()
      expect(mockClient.current.rpc).toHaveBeenCalledWith('confirm_delivery', {
        p_delivery_id: 1,
        p_signed_by_name: 'Jane Doe',
        p_signature_storage_path: null,
        p_notes: null,
        p_delivered: null,
      })
    })
  })

  describe('useCancelDelivery', () => {
    it('calls rpc("cancel_delivery") with { p_delivery_id }', async () => {
      mockClient.current.rpc.mockResolvedValueOnce({
        data: { success: true, delivery_id: 3, status: 'cancelled' },
        error: null,
      })
      const wrapper = createQueryWrapper()
      const { result } = renderHook(() => useCancelDelivery(), { wrapper })

      await result.current.mutateAsync({ deliveryId: 3 })

      expect(mockClient.current.rpc).toHaveBeenCalledWith('cancel_delivery', {
        p_delivery_id: 3,
      })
    })

    it('throws when the rpc reports success: false', async () => {
      mockClient.current.rpc.mockResolvedValueOnce({ data: { success: false }, error: null })
      const wrapper = createQueryWrapper()
      const { result } = renderHook(() => useCancelDelivery(), { wrapper })

      await expect(result.current.mutateAsync({ deliveryId: 3 })).rejects.toThrow(
        'cancel_delivery RPC returned unsuccessful',
      )
    })
  })
})
