/** Receiving workflow types */

/** Status of a receipt entry */
export type ReceiptStatus = 'draft' | 'confirmed'

/** Action to take for a line item */
export type ItemAction = 'pending' | 'update' | 'create' | 'skip'

/** Confidence level from AI parsing */
export type ParseConfidence = 'high' | 'low'

/** Destination type for received items */
export type DestinationType = 'project' | 'warehouse'

/** A receiving_log_entries row */
export interface ReceivingEntry {
  id: number
  receiving_log_id: number
  project_name: string | null
  vendor: string
  po_number: string | null
  raw_content: string | null
  file_url: string | null
  file_name: string | null
  parsed_content: Record<string, unknown> | null
  vendor_id: number | null
  project_id: number | null
  sort_order: number
  status: ReceiptStatus
  destination_type: DestinationType | null
  destination_folder_id: number | null
  date_received: string | null
  created_at: string
}

/** A receiving_items row */
export interface ReceivingItem {
  id: number
  receiving_entry_id: number
  sortly_item_id: number | null
  item_name: string
  part_number: string | null
  quantity_received: number
  action: ItemAction
  sortly_quantity_before: number | null
  sortly_quantity_after: number | null
  destination_folder_id: number | null
  destination_folder_name: string | null
  notes: string | null
  created_at: string
}

/** A receiving entry with its line items (for detail view) */
export interface ReceivingEntryWithItems extends ReceivingEntry {
  items: ReceivingItem[]
}

/** Item parsed from a packing list PDF */
export interface ParsedPackingItem {
  item_name: string
  part_number: string | null
  quantity_ordered: number
  quantity_shipped: number
  back_order: number
  confidence: ParseConfidence
}

/** Line item in the receiving form (transient UI state) */
export interface ReceivingLineItem {
  /** Temp ID for React key */
  tempId: string
  item_name: string
  part_number: string | null
  /** Qty from the PO / order */
  quantity_ordered: number
  /** Qty actually shipped (this becomes quantity_received for Sortly) */
  quantity_shipped: number
  /** Qty on back order */
  back_order: number
  /** Alias — qty to add to inventory (defaults to quantity_shipped) */
  quantity_received: number
  confidence: ParseConfidence
  /** Resolved action */
  action: ItemAction
  /** Linked Sortly item (null if creating new) */
  sortly_item_id: number | null
  /** Display name of the linked Sortly item */
  sortly_item_name: string | null
  /** Current quantity of the linked Sortly item */
  sortly_current_quantity: number | null
  /** Folder where item will be placed */
  destination_folder_id: number | null
  /** Folder name for display */
  destination_folder_name: string | null
  notes: string | null
  /** Tags to apply to the Sortly item */
  tags: string[]
}

/** A receiving_logs row (daily container) */
export interface ReceivingLog {
  id: number
  log_date: string
  notes: string | null
  created_by: string
  created_at: string
}

/** A daily log with all its entries + line items, ready for display/PDF */
export interface DailyReceivingLog {
  /** ISO date (YYYY-MM-DD) — the day this log covers */
  date: string
  /** All entries received this day across all logs (may include multiple users) */
  entries: ReceivingEntryWithItems[]
}

/** Input to the confirm receipt mutation */
export interface ConfirmReceiptParams {
  vendor: string
  po_number: string | null
  date_received: string
  destination_type: DestinationType
  destination_folder_id: number
  project_name: string | null
  project_id: number | null
  notes: string | null
  items: ReceivingLineItem[]
}
