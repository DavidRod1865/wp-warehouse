export interface SortlyPhoto {
  id: number;
  name: string;
  url: string;
}

export interface SortlyTag {
  name: string;
}

export interface SortlyItem {
  id: number;
  name: string;
  quantity?: number;
  price?: number;
  min_quantity?: number;
  notes?: string;
  type?: string; // 'folder' or 'item'
  parent_id?: number | null;
  created_at?: string;
  updated_at?: string;
  sid?: string;
  label_url?: string;
  label_url_type?: string;
  label_url_extra?: string;
  label_url_extra_type?: string;
  tag_names?: string[];
  tags?: SortlyTag[];
  photos?: SortlyPhoto[];
  custom_attribute_values?: Array<{
    custom_attribute_id: number;
    custom_attribute_name: string;
    value: string;
  }>;
}

export interface SortlyApiResponse {
  data: SortlyItem[];
  meta?: {
    pagination?: {
      page?: number;
      next_page_url?: string | null;
      total_pages?: number;
      total_count?: number;
    };
    current_page?: number;
    per_page?: number;
    total?: number;
  };
}
