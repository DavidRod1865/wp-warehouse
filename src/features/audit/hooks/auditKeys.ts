/** Centralized query keys for audit-related TanStack queries */
export const auditKeys = {
  all: ['audit'] as const,

  // Reconciliation view
  reconciliation: () => ['audit', 'reconciliation'] as const,
  reconciliationByProject: (projectId: number) =>
    ['audit', 'reconciliation', 'project', projectId] as const,

  // Cycle counts
  cycleCounts: () => ['audit', 'cycle_counts'] as const,
  cycleCountsByLocation: (locationId: number) =>
    ['audit', 'cycle_counts', 'location', locationId] as const,
  cycleCountDetail: (id: number) => ['audit', 'cycle_counts', 'detail', id] as const,
  cycleCountLines: (cycleCountId: number) =>
    ['audit', 'cycle_count_lines', cycleCountId] as const,

  // Signed deliveries
  signedDeliveries: () => ['audit', 'signed_deliveries'] as const,
  signedDeliveriesByFilter: (filters: object) =>
    ['audit', 'signed_deliveries', 'filter', filters] as const,
}
