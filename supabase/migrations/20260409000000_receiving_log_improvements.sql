-- Receiving log improvements: search indexes, vendor linking, and project linking
-- Supports the new quick-entry workflow, cross-month search, and Sortly integration

-- Add vendor_id FK for linking entries to known vendors
ALTER TABLE receiving_log_entries
  ADD COLUMN IF NOT EXISTS vendor_id integer REFERENCES vendor_addresses(id);

-- Add project_id FK for linking entries to projects (Sortly folder integration)
ALTER TABLE receiving_log_entries
  ADD COLUMN IF NOT EXISTS project_id integer REFERENCES projects(id);

-- Indexes for search performance (vendor, PO, project name)
CREATE INDEX IF NOT EXISTS idx_rle_vendor ON receiving_log_entries(vendor);
CREATE INDEX IF NOT EXISTS idx_rle_po_number ON receiving_log_entries(po_number);
CREATE INDEX IF NOT EXISTS idx_rle_project_name ON receiving_log_entries(project_name);
CREATE INDEX IF NOT EXISTS idx_rle_project_id ON receiving_log_entries(project_id);
