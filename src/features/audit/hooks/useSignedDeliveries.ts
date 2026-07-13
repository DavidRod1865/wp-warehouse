/**
 * useSignedDeliveries — Fetch delivered deliveries with confirmation data
 *
 * Filters: optional projectId, optional date range.
 * Includes the most recent delivery_confirmation row (signed_by_name,
 * signature_storage_path, legacy signature_url).
 *
 * getSignatureUrl — resolve private signed URL from delivery-signatures-v2
 * bucket (falls back to legacy public signature_url when no storage path).
 */
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase'
import { auditKeys } from './auditKeys'

export interface SignedDelivery {
  id: number
  delivery_number: string
  project_id: number | null
  project_name: string | null
  status: string
  delivered_at: string | null
  created_at: string
  signature_name: string | null
  // From the latest confirmation row
  confirmation_id: number | null
  signed_by_name: string | null
  signature_storage_path: string | null
  signature_url: string | null   // legacy public URL
  // Delivery items summary for PDF
  items?: Array<{ item_name: string; quantity: number; notes: string | null }>
}

export interface SignedDeliveryFilters {
  projectId?: number | null
  dateFrom?: string | null
  dateTo?: string | null
}

async function fetchSignedDeliveries(
  filters: SignedDeliveryFilters
): Promise<SignedDelivery[]> {
  let query = supabase
    .from('deliveries')
    .select(`
      id,
      delivery_number,
      project_id,
      status,
      delivered_at,
      created_at,
      signature_name,
      projects (name),
      delivery_confirmations (
        id,
        signed_by_name,
        signature_storage_path,
        signature_url,
        completed_at
      ),
      delivery_items (
        item_name,
        quantity,
        notes
      )
    `)
    .eq('status', 'delivered')
    .is('deleted_at', null)
    .order('delivered_at', { ascending: false })

  if (filters.projectId) {
    query = query.eq('project_id', filters.projectId)
  }

  if (filters.dateFrom) {
    query = query.gte('delivered_at', filters.dateFrom)
  }

  if (filters.dateTo) {
    // Include the full day
    const end = new Date(filters.dateTo)
    end.setDate(end.getDate() + 1)
    query = query.lt('delivered_at', end.toISOString().split('T')[0])
  }

  const { data, error } = await query
  if (error) throw error

  // Flatten confirmation: take the most recent completion
  return ((data || []) as unknown as Array<{
    id: number
    delivery_number: string
    project_id: number | null
    status: string
    delivered_at: string | null
    created_at: string
    signature_name: string | null
    projects: { name: string } | null
    delivery_confirmations: Array<{
      id: number
      signed_by_name: string | null
      signature_storage_path: string | null
      signature_url: string | null
      completed_at: string | null
    }>
    delivery_items: Array<{ item_name: string; quantity: number; notes: string | null }>
  }>).map((row) => {
    const confirmations = row.delivery_confirmations ?? []
    // Sort descending by completed_at; take most recent
    const latest = confirmations.sort((a, b) =>
      (b.completed_at ?? '').localeCompare(a.completed_at ?? '')
    )[0] ?? null

    return {
      id: row.id,
      delivery_number: row.delivery_number,
      project_id: row.project_id,
      project_name: row.projects?.name ?? null,
      status: row.status,
      delivered_at: row.delivered_at,
      created_at: row.created_at,
      signature_name: row.signature_name,
      confirmation_id: latest?.id ?? null,
      signed_by_name: latest?.signed_by_name ?? row.signature_name ?? null,
      signature_storage_path: latest?.signature_storage_path ?? null,
      signature_url: latest?.signature_url ?? null,
      items: row.delivery_items ?? [],
    }
  })
}

export function useSignedDeliveries(filters: SignedDeliveryFilters = {}) {
  return useQuery({
    queryKey: auditKeys.signedDeliveriesByFilter(filters),
    queryFn: () => fetchSignedDeliveries(filters),
    staleTime: 60 * 1000,
  })
}

/**
 * Resolve a viewable URL for the signature image.
 * Prefers the private bucket (delivery-signatures-v2) signed URL when a
 * storage path exists, falls back to the legacy public signature_url.
 */
export async function getSignatureUrl(
  storagePath: string | null,
  legacyUrl: string | null
): Promise<string | null> {
  if (storagePath) {
    const { data, error } = await supabase.storage
      .from('delivery-signatures-v2')
      .createSignedUrl(storagePath, 3600) // 1-hour expiry

    if (error) {
      console.warn('Failed to create signed URL for signature:', error.message)
      return legacyUrl ?? null
    }
    return data.signedUrl
  }
  return legacyUrl ?? null
}
