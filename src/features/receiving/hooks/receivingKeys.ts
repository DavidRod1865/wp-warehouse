/** TanStack Query key factory for receiving feature */
export const receivingKeys = {
  all: ['receipts'] as const,
  list: () => ['receipts', 'list'] as const,
  detail: (id: number) => ['receipts', 'detail', id] as const,
  items: (entryId: number) => ['receipts', 'items', entryId] as const,
  /** Daily log (all entries for a given date) */
  daily: (date: string) => ['receipts', 'daily', date] as const,
  /** All dates that have at least one entry */
  dates: () => ['receipts', 'dates'] as const,
}
