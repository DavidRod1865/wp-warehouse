/**
 * Query key factory for purchase orders
 */

export const poKeys = {
  all: () => ['purchase-orders'] as const,
  lists: () => [...poKeys.all(), 'list'] as const,
  list: (filters?: { project_id?: number; vendor_id?: number; status?: string }) =>
    [...poKeys.lists(), filters] as const,
  details: () => [...poKeys.all(), 'detail'] as const,
  detail: (id: number) => [...poKeys.details(), id] as const,
  lineItems: (poId: number) => [...poKeys.detail(poId), 'lines'] as const,
}
