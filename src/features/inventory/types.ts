// ============================================================================
// INVENTORY CORE TYPES (Supabase-based, Phase 1+)
// ============================================================================

export interface Location {
  id: number
  name: string
  location_type: 'warehouse_area' | 'truck' | 'job_site' | 'rigging_yard'
  parent_location_id: number | null
  project_id: number | null
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
  // Joined data (available when selected with join)
  location?: Location
  item?: Pick<InventoryItem, 'id' | 'name' | 'part_number'> | null
}

export interface InventoryMovement {
  id: number
  movement_type: 'receive' | 'transfer' | 'load_truck' | 'deliver' | 'adjust' | 'return'
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
