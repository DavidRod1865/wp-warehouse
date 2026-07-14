import type { Address } from '../../types/address'

export type DeliveryStatus = 'draft' | 'pending' | 'in_transit' | 'delivered' | 'cancelled'

export interface Delivery {
  id: number
  delivery_number: string
  po_reference?: string | null
  project_id: number | null
  driver_id: string | null
  status: DeliveryStatus
  created_at: string
  started_at: string | null
  delivered_at: string | null
  deleted_at: string | null
  from_address: Address
  to_address: Address
  // Legacy Sortly columns — kept for old-row display only; new code uses below
  from_location_id?: number | null
  truck_sortly_folder_id?: number | null
  from_location_type?: string | null
  // Phase 5+ first-party columns
  truck_location_id?: number | null
  from_location_ref?: number | null
  truck_name?: string | null
  delivery_type: string
  signature_name: string | null
  signature_data: string | null
  items_count?: number
  activity_log: ActivityLogEntry[]
  projects?: { name: string } | null
}

export interface DeliveryItem {
  id?: number
  delivery_id?: number
  // Legacy Sortly column — kept for type completeness; new rows will be null
  sortly_item_id?: number | null
  // Phase 5+ first-party column
  item_id?: number | null
  item_name: string
  quantity: number
  delivered_quantity: number
  remaining_quantity: number
  available_quantity?: number
  location?: string
  original_quantity?: number
  is_manual?: boolean
  notes: string | null
  custom_attribute_values?: Array<{
    custom_attribute_id: number
    custom_attribute_name: string
    value: string
  }> | null
}

export interface ActivityLogEntry {
  timestamp: string
  action: string
  user_id?: string
  user_email?: string
  user_name?: string
  details?: Record<string, unknown>
}

export interface DeliveryConfirmation {
  id: number
  delivery_id: number
  driver_id: string
  completed_at: string
  signed_by_name: string
  signature_url: string | null
  signature_storage_path: string | null
  status: string
  notes: string | null
  created_at: string
}

export interface DeliveryFormValues {
  delivery_number: string
  po_reference: string
  project_id: number | null
  truck_folder_id: number | null
  from_location_id: number | null
  from_address: Address
  to_address: Address
  items: DeliveryItem[]
  driver_id: string | null
  status: DeliveryStatus
}
