/**
 * projectKeys — Centralized query keys for projects
 */
export const projectKeys = {
  all: ['projects'] as const,

  // Lists
  list: () => ['projects', 'list'] as const,
  listByStatus: (status: string) => ['projects', 'list', 'status', status] as const,
  listActive: () => ['projects', 'list', 'active'] as const,
  listByGC: (gcId: number) => ['projects', 'list', 'gc', gcId] as const,
  listSearch: (query: string) => ['projects', 'list', 'search', query] as const,

  // Details
  detail: (id: number) => ['projects', 'detail', id] as const,
}
