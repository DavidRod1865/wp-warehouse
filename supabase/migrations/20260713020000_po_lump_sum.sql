-- PO lump-sum pricing: used when vendors quote a single total instead of per-line unit prices
-- Existing purchase_orders RLS covers all columns; re-assert policies so this migration is self-contained.

ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS lump_sum_amount NUMERIC(12,2);

COMMENT ON COLUMN purchase_orders.lump_sum_amount IS
  'PO-level total when line items are not individually priced; null when using per-line unit_price';

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Managers can view, insert, update all purchase_orders" ON purchase_orders;
CREATE POLICY "Managers can view, insert, update all purchase_orders"
  ON purchase_orders FOR ALL
  USING (is_manager())
  WITH CHECK (is_manager());

DROP POLICY IF EXISTS "Authenticated users can view purchase_orders" ON purchase_orders;
CREATE POLICY "Authenticated users can view purchase_orders"
  ON purchase_orders FOR SELECT
  TO authenticated
  USING (true);
