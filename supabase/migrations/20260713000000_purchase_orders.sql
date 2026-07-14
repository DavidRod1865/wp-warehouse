-- Phase 3: Purchase Orders
-- Adds purchase_orders and po_line_items tables with full RLS
-- Includes PDF storage bucket for PO documents

-- ============================================================================
-- 1. PURCHASE_ORDERS TABLE
-- ============================================================================

CREATE TABLE purchase_orders (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  po_number TEXT NOT NULL UNIQUE,
  vendor_id BIGINT NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  po_date DATE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'partially_received', 'received', 'cancelled')),
  pdf_storage_path TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE purchase_orders IS 'Purchase orders issued to vendors for equipment and materials';
COMMENT ON COLUMN purchase_orders.po_number IS 'Unique purchase order number (e.g., PO-2026-001)';
COMMENT ON COLUMN purchase_orders.status IS 'PO lifecycle: draft → confirmed → partially_received → received or cancelled';
COMMENT ON COLUMN purchase_orders.pdf_storage_path IS 'Path to uploaded PDF in storage.purchase-orders bucket';

CREATE INDEX idx_purchase_orders_vendor_id ON purchase_orders(vendor_id);
CREATE INDEX idx_purchase_orders_project_id ON purchase_orders(project_id);
CREATE INDEX idx_purchase_orders_status ON purchase_orders(status);
CREATE INDEX idx_purchase_orders_created_at ON purchase_orders(created_at DESC);

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can view, insert, update all purchase_orders"
  ON purchase_orders FOR ALL
  USING (is_manager())
  WITH CHECK (is_manager());

CREATE POLICY "Authenticated users can view purchase_orders"
  ON purchase_orders FOR SELECT
  TO authenticated USING (true);

-- ============================================================================
-- 2. PO_LINE_ITEMS TABLE
-- ============================================================================

CREATE TABLE po_line_items (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  po_id BIGINT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  line_number INTEGER NOT NULL,
  description TEXT NOT NULL,
  part_number TEXT,
  item_id BIGINT REFERENCES items(id) ON DELETE SET NULL,
  quantity_ordered INTEGER NOT NULL CHECK (quantity_ordered > 0),
  unit_price NUMERIC(12,2),
  quantity_received INTEGER NOT NULL DEFAULT 0 CHECK (quantity_received >= 0),
  received_status TEXT NOT NULL DEFAULT 'pending' CHECK (received_status IN ('pending', 'partial', 'received', 'over_received')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(po_id, line_number)
);

COMMENT ON TABLE po_line_items IS 'Individual line items on a purchase order';
COMMENT ON COLUMN po_line_items.received_status IS 'Receiving status: pending (none received), partial (some received), received (full qty), over_received (excess)';
COMMENT ON COLUMN po_line_items.item_id IS 'Reference to inventory item (NULL until linked during receiving)';

CREATE INDEX idx_po_line_items_po_id ON po_line_items(po_id);
CREATE INDEX idx_po_line_items_received_status ON po_line_items(po_id, received_status);
CREATE INDEX idx_po_line_items_part_number ON po_line_items(part_number);

ALTER TABLE po_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can view, insert, update all po_line_items"
  ON po_line_items FOR ALL
  USING (EXISTS (SELECT 1 FROM purchase_orders WHERE id = po_id AND is_manager()))
  WITH CHECK (EXISTS (SELECT 1 FROM purchase_orders WHERE id = po_id AND is_manager()));

CREATE POLICY "Authenticated users can view po_line_items"
  ON po_line_items FOR SELECT
  TO authenticated USING (EXISTS (SELECT 1 FROM purchase_orders WHERE id = po_id));

-- ============================================================================
-- 3. STORAGE: PURCHASE-ORDERS BUCKET AND POLICIES
-- ============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('purchase-orders', 'purchase-orders', false)
ON CONFLICT DO NOTHING;

-- Allow managers to insert, select, update, delete PO PDFs
CREATE POLICY "Managers can manage PO PDFs"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (bucket_id = 'purchase-orders' AND is_manager())
  WITH CHECK (bucket_id = 'purchase-orders' AND is_manager());

-- Allow authenticated users to select (download) PO PDFs
CREATE POLICY "Authenticated users can view PO PDFs"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'purchase-orders');
