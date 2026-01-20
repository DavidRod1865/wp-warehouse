export type ActivityAction =
  | "created"
  | "edited"
  | "printed"
  | "delivered"
  | "deleted"
  | "status_changed"
  | "items_added"
  | "items_removed"
  | "items_quantity_changed"
  | "project_changed"
  | "truck_changed"
  | "driver_assigned"
  | "address_changed";

export interface ActivityLogEntry {
  timestamp: string;
  action: ActivityAction;
  user_id?: string;
  user_email?: string;
  user_name?: string; // NEW: Store username for display
  details?: {
    status?: string;
    previous_status?: string;
    new_status?: string;
    items_added?: Array<{ item_name: string; quantity: number }>;
    items_removed?: Array<{ item_name: string; quantity: number }>;
    quantity_changes?: Array<{
      item_name: string;
      old_quantity: number;
      new_quantity: number;
    }>;
    project_changed?: {
      from: string | null;
      to: string | null;
    };
    truck_changed?: {
      from: string;
      to: string;
    };
    driver_assigned?: {
      driver_name: string;
    };
    address_changed?: {
      field: "from_address" | "to_address";
      changes: Record<string, { old: string; new: string }>;
    };
    signed_by_name?: string;
    signature_path?: string;
    note?: string;
    delivery_type?: string;
    project_name?: string;
    truck_name?: string;
    items_count?: number;
    [key: string]: any;
  };
}
