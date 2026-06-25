/**
 * sortlyKeys — Centralized query keys for all Sortly-related queries
 *
 * Hierarchical key structure enables targeted cache invalidation:
 *   invalidateQueries(['sortly'])           → all Sortly data
 *   invalidateQueries(['sortly', 'items'])  → all item queries
 *   invalidateQueries(['sortly', 'items', folderId]) → items in one folder
 */
export const sortlyKeys = {
  all: ['sortly'] as const,

  // Items
  items: () => ['sortly', 'items'] as const,
  allItems: () => ['sortly', 'items', 'all'] as const,
  itemList: (folderId: number) => ['sortly', 'items', folderId] as const,
  itemListRecursive: (folderId: number) => ['sortly', 'items', 'recursive', folderId] as const,
  itemDetail: (itemId: number) => ['sortly', 'items', 'detail', itemId] as const,

  // Folders
  folders: () => ['sortly', 'folders'] as const,
  folderChildren: (folderId: number) => ['sortly', 'folders', folderId] as const,

  // Search
  search: (query: string) => ['sortly', 'search', query] as const,

  // Custom fields
  customFields: () => ['sortly', 'customFields'] as const,

  // Alerts
  alerts: () => ['sortly', 'alerts'] as const,
}
