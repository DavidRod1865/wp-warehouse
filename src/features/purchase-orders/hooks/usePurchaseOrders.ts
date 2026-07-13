/**
 * usePurchaseOrders — Query hook for purchase orders list with filters
 */
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase'
import { poKeys } from './poKeys'
import type { PurchaseOrder } from '../types'

interface UsePurchaseOrdersOptions {
  project_id?: number
  vendor_id?: number
  status?: string
  search?: string
}

export function usePurchaseOrders({
  project_id,
  vendor_id,
  status,
  search = '',
}: UsePurchaseOrdersOptions = {}) {
  return useQuery({
    queryKey: poKeys.list({ project_id, vendor_id, status }),
    queryFn: async () => {
      let query = supabase
        .from('purchase_orders')
        .select(
          `
          *,
          vendor:vendors(id, name),
          project:projects(id, name),
          line_items:po_line_items(*)
          `
        )

      if (project_id) {
        query = query.eq('project_id', project_id)
      }

      if (vendor_id) {
        query = query.eq('vendor_id', vendor_id)
      }

      if (status) {
        query = query.eq('status', status)
      }

      if (search) {
        query = query.or(
          `po_number.ilike.%${search}%,notes.ilike.%${search}%`
        )
      }

      const { data, error } = await query.order('created_at', {
        ascending: false,
      })

      if (error) throw error
      return data as Array<
        PurchaseOrder & {
          line_items?: Array<{
            id: number
            po_id: number
            line_number: number
            description: string
            part_number: string | null
            item_id: number | null
            quantity_ordered: number
            unit_price: number | null
            quantity_received: number
            received_status: 'pending' | 'partial' | 'received' | 'over_received'
            notes: string | null
            created_at: string
            updated_at: string
          }>
        }
      >
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

/**
 * usePurchaseOrder — Query hook for single PO with line items
 */
export function usePurchaseOrder(id: number) {
  return useQuery({
    queryKey: poKeys.detail(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(
          `
          *,
          vendor:vendors(id, name),
          project:projects(id, name),
          line_items:po_line_items(*)
          `
        )
        .eq('id', id)
        .single()

      if (error) throw error
      return data as PurchaseOrder & {
        line_items: Array<{
          id: number
          po_id: number
          line_number: number
          description: string
          part_number: string | null
          item_id: number | null
          quantity_ordered: number
          unit_price: number | null
          quantity_received: number
          received_status: 'pending' | 'partial' | 'received' | 'over_received'
          notes: string | null
          created_at: string
          updated_at: string
        }>
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}
