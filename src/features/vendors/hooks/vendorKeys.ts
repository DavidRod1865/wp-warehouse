/**
 * vendorKeys — Centralized query keys for vendors
 */
export const vendorKeys = {
  all: ['vendors'] as const,

  // Lists
  list: () => ['vendors', 'list'] as const,
  listActive: () => ['vendors', 'list', 'active'] as const,
  listSearch: (query: string) => ['vendors', 'list', 'search', query] as const,

  // Details
  detail: (id: number) => ['vendors', 'detail', id] as const,
}
