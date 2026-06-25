/** Centralized query keys for delivery-related TanStack queries */
export const deliveryKeys = {
  all: ['deliveries'] as const,
  list: (filters?: object) => ['deliveries', 'list', filters] as const,
  detail: (id: number) => ['deliveries', 'detail', id] as const,
  items: (deliveryId: number) => ['deliveries', 'items', deliveryId] as const,
  confirmation: (deliveryId: number) => ['deliveries', 'confirmation', deliveryId] as const,
  nextNumber: () => ['deliveries', 'nextNumber'] as const,
}
