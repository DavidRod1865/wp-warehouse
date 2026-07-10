// Re-export Sortly types for backward compatibility (receiving/deliveries still use them)
export type {
  SortlyItem,
  SortlyApiResponse,
  SortlyPhoto,
  SortlyTag,
  CreateItemParams,
  CopyItemParams,
  SearchItemsParams,
  SortlyCustomField,
  SortlyAlert,
} from '../../types/sortly'

// ============================================================================
// NEW INVENTORY CORE TYPES (Supabase-based)
// ============================================================================

export interface Location {
  id: number
  name: string
  location_type: 'warehouse_area' | 'truck' | 'job_site'
  parent_location_id: number | null
  address: Record<string, string> | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface InventoryItem {
  id: number
  name: string
  part_number: string | null
  description: string | null
  unit_cost: number | null
  created_at: string
  updated_at: string
}

export interface StockLevel {
  id: number
  location_id: number
  item_id: number
  quantity: number
  updated_at: string
  // Joined data
  location?: Location
  item?: InventoryItem
}

export interface InventoryMovement {
  id: number
  movement_type: 'receive' | 'transfer' | 'load_truck' | 'deliver' | 'adjust'
  from_location_id: number | null
  to_location_id: number | null
  item_id: number
  quantity: number
  actor_id: string | null
  reference_type: string | null
  reference_id: number | null
  notes: string | null
  created_at: string
  // Joined data
  item?: InventoryItem
  from_location?: Location
  to_location?: Location
}
