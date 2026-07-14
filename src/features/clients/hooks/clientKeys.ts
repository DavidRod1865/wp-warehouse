/**
 * clientKeys — Centralized query keys for clients (general contractors)
 */
export const clientKeys = {
  all: ['clients'] as const,

  // Lists
  list: () => ['clients', 'list'] as const,
  listActive: () => ['clients', 'list', 'active'] as const,
  listSearch: (query: string) => ['clients', 'list', 'search', query] as const,

  // Details
  detail: (id: number) => ['clients', 'detail', id] as const,
  detailProjects: (id: number) => ['clients', 'detail', id, 'projects'] as const,
}
