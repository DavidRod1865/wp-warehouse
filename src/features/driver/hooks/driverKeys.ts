/** Centralized query keys for driver-specific TanStack queries */
export const driverKeys = {
  all: ['driver'] as const,
  deliveries: (driverId: string) => ['driver', 'deliveries', driverId] as const,
  delivery: (id: number) => ['driver', 'delivery', id] as const,
  deliveryItems: (deliveryId: number) => ['driver', 'delivery', deliveryId, 'items'] as const,
}
