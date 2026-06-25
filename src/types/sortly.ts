export interface SortlyPhoto {
  id: number
  name: string
  url: string
}

export interface SortlyTag {
  name: string
}

export interface SortlyItem {
  id: number
  name: string
  quantity?: number
  price?: number
  min_quantity?: number
  notes?: string
  type?: string // 'folder' or 'item'
  parent_id?: number | null
  created_at?: string
  updated_at?: string
  sid?: string
  label_url?: string
  label_url_type?: string
  label_url_extra?: string
  label_url_extra_type?: string
  tag_names?: string[]
  tags?: SortlyTag[]
  photos?: SortlyPhoto[]
  custom_attribute_values?: Array<{
    custom_attribute_id: number
    custom_attribute_name: string
    value: string
  }>
  measured_quantity?: { value: number; type: string; name: string; scale: number }
  item_group_id?: number
  option_value_ids?: number[]
}

export interface SortlyApiResponse {
  data: SortlyItem[]
  meta?: {
    pagination?: {
      page?: number
      next_page_url?: string | null
      total_pages?: number
      total_count?: number
    }
    current_page?: number
    per_page?: number
    total?: number
  }
}

// ── Create / Copy / Search params ─────────────────────

export interface CreateItemParams {
  name: string
  type: 'item' | 'folder'
  parent_id?: number
  quantity?: number
  min_quantity?: number
  price?: number
  sid?: string
  notes?: string
  tags?: SortlyTag[]
  label_url?: string
  label_url_type?: string
  label_url_extra?: string
  label_url_extra_type?: string
  custom_attribute_values?: Array<{
    custom_attribute_id: number
    value: string
  }>
  photos?: string[]
}

export interface CopyItemParams {
  quantity: number
  folder_id: number
  include_subtree?: boolean
  new_sid?: string
}

export interface SearchItemsParams {
  name?: string
  type?: 'item' | 'folder'
  folder_ids?: number[]
  per_page?: number
  page?: number
  include?: string
}

// ── Custom Fields ─────────────────────────────────────

export interface SortlyCustomField {
  id: number
  name: string
  type: string
  applies_to: string
  created_at: string
  updated_at: string
}

// ── Alerts ────────────────────────────────────────────

export interface SortlyAlert {
  id: number
  item_id: number
  alert_type: string
  threshold?: number
  enabled: boolean
  created_at: string
  updated_at: string
}

export interface CreateAlertParams {
  item_id: number
  alert_type: string
  threshold?: number
  enabled?: boolean
}

export interface UpdateAlertParams {
  alert_type?: string
  threshold?: number
  enabled?: boolean
}
