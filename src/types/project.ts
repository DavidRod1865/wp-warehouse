export interface Project {
  id: number
  name: string
  status: string
  sortly_warehouse_folder_id?: number
  sortly_jobsite_folder_id?: number
  general_contractor?: string
  project_address?: {
    street_address?: string
    city?: string
    state?: string
    zip_code?: string
    phone?: string
  }
}
