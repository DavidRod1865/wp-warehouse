export interface Project {
  id: number
  name: string
  status: string
  sortly_warehouse_folder_id?: number
  sortly_jobsite_folder_id?: number
  sortly_project_folder_id?: number
  general_contractor?: string
  gc_id?: number
  job_site_location_id?: number
  project_address?: {
    street_address?: string
    city?: string
    state?: string
    zip_code?: string
    phone?: string
  }
  notes?: string
  created_at?: string
  updated_at?: string
}
