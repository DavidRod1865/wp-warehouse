/**
 * inventoryKeys — Centralized query keys for Supabase inventory tables
 *
 * Hierarchical key structure enables targeted cache invalidation:
 *   invalidateQueries(['inventory'])           → all inventory data
 *   invalidateQueries(['inventory', 'items'])  → all item queries
 *   invalidateQueries(['inventory', 'stock_levels']) → all stock level queries
 */
export const inventoryKeys = {
  all: ['inventory'] as const,

  // Locations
  locations: () => ['inventory', 'locations'] as const,
  locationsByType: (type: string) => ['inventory', 'locations', 'type', type] as const,
  locationDetail: (id: number) => ['inventory', 'locations', 'detail', id] as const,

  // Items
  items: () => ['inventory', 'items'] as const,
  itemsByType: (type: string) => ['inventory', 'items', 'type', type] as const,
  itemDetail: (id: number) => ['inventory', 'items', 'detail', id] as const,
  itemSearch: (query: string) => ['inventory', 'items', 'search', query] as const,

  // Stock Levels
  stockLevels: () => ['inventory', 'stock_levels'] as const,
  stockByLocation: (locationId: number) => ['inventory', 'stock_levels', 'location', locationId] as const,
  stockByItem: (itemId: number) => ['inventory', 'stock_levels', 'item', itemId] as const,
  allStockByItem: () => ['inventory', 'stock_levels', 'all_by_item'] as const,
  stockByProject: (projectId: number) => ['inventory', 'stock_levels', 'project', projectId] as const,

  // Movements
  movements: () => ['inventory', 'movements'] as const,
  movementsByItem: (itemId: number) => ['inventory', 'movements', 'item', itemId] as const,
  movementsByReference: (refType: string, refId: number) => ['inventory', 'movements', 'ref', refType, refId] as const,
  returnsByProject: (projectId: number) => ['inventory', 'movements', 'returns', 'project', projectId] as const,
}
