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
  /** Phase 4+: linked purchase order id */
  po_id: number | null
  raw_content: string | null
  file_url: string | null
  file_name: string | null
  parsed_content: Record<string, unknown> | null
  vendor_id: number | null
  project_id: number | null
  sort_order: number
  status: ReceiptStatus
  destination_type: DestinationType | null
  /** Legacy Sortly field — kept for old rows, ignored in new code */
  destination_folder_id: number | null
  /** Phase 4+: inventory location id */
  destination_location_id: number | null
  date_received: string | null
  created_at: string
}

/** A receiving_items row */
export interface ReceivingItem {
  id: number
  receiving_entry_id: number
  /** Phase 4+: PO line item linked to this row */
  po_line_item_id: number | null
  /** Phase 4+: inventory item id */
  item_id: number | null
  /** Legacy Sortly field — kept for old rows */
  sortly_item_id: number | null
  item_name: string
  part_number: string | null
  quantity_received: number
  action: ItemAction
  /** Legacy Sortly field — kept for old rows */
  sortly_quantity_before: number | null
  /** Legacy Sortly field — kept for old rows */
  sortly_quantity_after: number | null
  /** Legacy Sortly field — kept for old rows */
  destination_folder_id: number | null
  /** Legacy Sortly field — kept for old rows */
  destination_folder_name: string | null
  /** Phase 4+: inventory location id */
  destination_location_id: number | null
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

/** Represents a PO line item suggestion shown during item matching */
export interface POLineSuggestion {
  po_line_item_id: number
  description: string
  part_number: string | null
  quantity_ordered: number
  /** Already received across all prior receipts */
  quantity_already_received: number
  /** remaining = ordered − already_received */
  quantity_remaining: number
  received_status: 'pending' | 'partial' | 'received' | 'over_received'
  item_id: number | null
}

/** Line item in the receiving form (transient UI state) */
export interface ReceivingLineItem {
  /** Temp ID for React key */
  tempId: string
  item_name: string
  part_number: string | null
  /** Qty from the PO / order */
  quantity_ordered: number
  /** Qty actually shipped */
  quantity_shipped: number
  /** Qty on back order */
  back_order: number
  /** Qty to add to inventory (defaults to quantity_shipped) */
  quantity_received: number
  confidence: ParseConfidence
  /** Resolved action */
  action: ItemAction
  /** Phase 4+: Linked inventory item id */
  item_id: number | null
  /** Phase 4+: Linked inventory item name (for display) */
  item_name_linked: string | null
  /** Phase 4+: Current stock quantity at destination (for display) */
  current_stock_quantity: number | null
  /** Phase 4+: Linked PO line item id */
  po_line_item_id: number | null
  /** Phase 4+: PO line suggestion (for display/validation) */
  po_line_suggestion: POLineSuggestion | null
  /** Phase 4+: destination location id */
  destination_location_id: number | null
  /** Phase 4+: destination location name (for display) */
  destination_location_name: string | null
  notes: string | null
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

/** Input to the confirm receipt mutation (Phase 4) */
export interface ConfirmReceiptParams {
  vendor: string
  vendor_id: number | null
  po_id: number | null
  po_number: string | null
  date_received: string
  destination_type: DestinationType
  destination_location_id: number | null
  project_name: string | null
  project_id: number | null
  notes: string | null
  items: ReceivingLineItem[]
}

/** Single item payload for the confirm_receipt RPC */
export interface ConfirmReceiptItemPayload {
  po_line_item_id: number | null
  item_id: number | null
  new_item: { name: string; part_number: string | null } | null
  item_name: string
  part_number: string | null
  quantity_received: number
  destination_location_id: number
  notes: string | null
}
