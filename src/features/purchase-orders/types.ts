/**
 * Purchase Order types
 */

export interface PurchaseOrder {
  id: number
  po_number: string
  vendor_id: number
  project_id: number
  po_date: string | null // YYYY-MM-DD
  status: 'draft' | 'confirmed' | 'partially_received' | 'received' | 'cancelled'
  pdf_storage_path: string | null
  lump_sum_amount: number | null
  notes: string | null
  created_by: string | null // UUID
  created_at: string
  updated_at: string
  // Joined data
  vendor?: { id: number; name: string }
  project?: { id: number; name: string }
}

export interface POLineItem {
  id: number
  po_id: number
  line_number: number
  description: string
  part_number: string | null
  item_id: number | null
  quantity_ordered: number
  unit_price: number | null
  quantity_received: number
  received_status: 'pending' | 'partial' | 'received' | 'over_received'
  notes: string | null
  created_at: string
  updated_at: string
}

export interface PurchaseOrderDetail extends PurchaseOrder {
  line_items?: POLineItem[]
}

/**
 * AI-parsed PO response from parse-purchase-order edge function
 */
export interface ParsedPurchaseOrderLine {
  line_number: number
  description: string
  part_number: string | null
  quantity_ordered: number
  unit_price: number | null
  confidence: 'high' | 'low'
}

export interface ParsedPurchaseOrder {
  po_number: string | null
  vendor_name: string | null
  po_date: string | null // YYYY-MM-DD or null
  /** Document grand total / lump sum when line prices are absent */
  total_amount: number | null
  lines: ParsedPurchaseOrderLine[]
}

/**
 * Form data for creating/editing a PO
 * Note: vendor_id is stored as number in forms (number in DB is converted to number by Supabase)
 */
export interface POFormData {
  po_number: string
  vendor_id: number
  project_id: number
  po_date: string | null
  pricing_mode?: 'per_line' | 'lump_sum'
  lump_sum_amount: number | null
  lines: {
    line_number: number
    description: string
    part_number: string | null
    quantity_ordered: number
    unit_price: number | null
    notes: string | null
  }[]
  notes: string | null
}
