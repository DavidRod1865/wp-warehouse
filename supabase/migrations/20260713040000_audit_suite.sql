-- Phase 5b: Audit Suite
-- 1. Reconciliation VIEW (po_project_reconciliation)
-- 2. Cycle count tables (cycle_counts, cycle_count_lines)
-- 3. finalize_cycle_count RPC

-- ============================================================================
-- 1. VIEW: po_project_reconciliation
-- ============================================================================
-- One row per po_line_item on non-cancelled POs.
-- Joins PO → project → item; subqueries compute delivered-to-site, on-hand
-- warehouse, and on-truck quantities from the live ledger / stock_levels.
-- reconciliation_state is derived from the relationship between ordered,
-- received, and delivered quantities.
-- ============================================================================

CREATE OR REPLACE VIEW po_project_reconciliation
WITH (security_invoker = on)
AS
SELECT
  -- Project
  p.id                        AS project_id,
  p.name                      AS project_name,

  -- PO
  po.id                       AS po_id,
  po.po_number,

  -- Vendor
  v.name                      AS vendor_name,

  -- Line item identity
  li.id                       AS po_line_item_id,
  li.line_number,
  li.description,
  li.part_number,
  li.item_id,

  -- Receiving progress (direct from table)
  li.quantity_ordered,
  li.quantity_received,
  li.received_status,

  -- Qty delivered to this project's job-site (sum of 'deliver' ledger movements
  -- where the destination is the project's job_site_location_id)
  COALESCE((
    SELECT SUM(im.quantity)
    FROM   inventory_movements im
    WHERE  im.movement_type  = 'deliver'
      AND  im.item_id        = li.item_id
      AND  im.to_location_id = p.job_site_location_id
  ), 0)                       AS qty_delivered_to_site,

  -- Qty on hand across all warehouse_area locations
  COALESCE((
    SELECT SUM(sl.quantity)
    FROM   stock_levels sl
    JOIN   locations    l  ON l.id = sl.location_id
    WHERE  sl.item_id       = li.item_id
      AND  l.location_type  = 'warehouse_area'
  ), 0)                       AS qty_on_hand_warehouse,

  -- Qty currently on trucks
  COALESCE((
    SELECT SUM(sl.quantity)
    FROM   stock_levels sl
    JOIN   locations    l  ON l.id = sl.location_id
    WHERE  sl.item_id      = li.item_id
      AND  l.location_type = 'truck'
  ), 0)                       AS qty_on_truck,

  -- Reconciliation state — evaluated after computing the subquery values above.
  -- We re-evaluate inline using the same subquery logic inside a CASE so the
  -- view remains a single SELECT (no WITH / LATERAL nesting required for state).
  CASE
    -- Data anomaly: more delivered than received
    WHEN COALESCE((
           SELECT SUM(im.quantity)
           FROM   inventory_movements im
           WHERE  im.movement_type  = 'deliver'
             AND  im.item_id        = li.item_id
             AND  im.to_location_id = p.job_site_location_id
         ), 0) > li.quantity_received
      THEN 'over_delivered'

    -- Fully delivered and all received (happy path)
    WHEN li.quantity_received >= li.quantity_ordered
     AND COALESCE((
           SELECT SUM(im.quantity)
           FROM   inventory_movements im
           WHERE  im.movement_type  = 'deliver'
             AND  im.item_id        = li.item_id
             AND  im.to_location_id = p.job_site_location_id
         ), 0) >= li.quantity_received
      THEN 'complete'

    -- Items received and sitting on a truck (in_transit)
    WHEN li.quantity_received > 0
     AND COALESCE((
           SELECT SUM(sl.quantity)
           FROM   stock_levels sl
           JOIN   locations    l  ON l.id = sl.location_id
           WHERE  sl.item_id      = li.item_id
             AND  l.location_type = 'truck'
         ), 0) > 0
      THEN 'in_transit'

    -- Items received but still in the warehouse
    WHEN li.quantity_received > 0
      THEN 'in_warehouse'

    -- Not yet fully received
    ELSE 'backorder'
  END                         AS reconciliation_state

FROM   po_line_items        li
JOIN   purchase_orders      po ON po.id = li.po_id
JOIN   projects             p  ON p.id  = po.project_id
LEFT   JOIN vendors         v  ON v.id  = po.vendor_id
WHERE  po.status <> 'cancelled';

-- Grant to authenticated (view has security_invoker = on so caller's RLS applies)
GRANT SELECT ON po_project_reconciliation TO authenticated;

-- ============================================================================
-- 2. TABLES: cycle_counts + cycle_count_lines
-- ============================================================================

CREATE TABLE cycle_counts (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  location_id  BIGINT NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  status       TEXT   NOT NULL DEFAULT 'draft'
               CHECK (status IN ('draft', 'finalized', 'cancelled')),
  counted_by   UUID   REFERENCES auth.users(id) ON DELETE SET NULL,
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT now(),
  finalized_at TIMESTAMPTZ
);

COMMENT ON TABLE cycle_counts IS
  'Physical inventory cycle counts scoped to a single location';
COMMENT ON COLUMN cycle_counts.status IS
  'draft = in progress, finalized = adjustments applied, cancelled = abandoned';

CREATE INDEX idx_cycle_counts_location_id  ON cycle_counts(location_id);
CREATE INDEX idx_cycle_counts_status       ON cycle_counts(status);
CREATE INDEX idx_cycle_counts_counted_by   ON cycle_counts(counted_by);

ALTER TABLE cycle_counts ENABLE ROW LEVEL SECURITY;

-- Managers: full access
CREATE POLICY "Managers can manage cycle_counts"
  ON cycle_counts FOR ALL
  TO authenticated
  USING (is_manager())
  WITH CHECK (is_manager());

-- Authenticated: read-only
CREATE POLICY "Authenticated users can view cycle_counts"
  ON cycle_counts FOR SELECT
  TO authenticated USING (true);

-- ── Cycle count lines ────────────────────────────────────────────────────────

CREATE TABLE cycle_count_lines (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cycle_count_id   BIGINT NOT NULL REFERENCES cycle_counts(id) ON DELETE CASCADE,
  item_id          BIGINT NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  quantity_system  INTEGER,            -- snapshotted at finalize time
  quantity_counted INTEGER,            -- entered by the counter; NULL = not yet counted
  UNIQUE (cycle_count_id, item_id)
);

COMMENT ON TABLE cycle_count_lines IS
  'Individual item lines within a cycle count';
COMMENT ON COLUMN cycle_count_lines.quantity_system IS
  'Stock level at the time of finalization (captured just before adjustment)';
COMMENT ON COLUMN cycle_count_lines.quantity_counted IS
  'Physical count entered by the user; NULL until counted';

CREATE INDEX idx_cycle_count_lines_cycle_count_id ON cycle_count_lines(cycle_count_id);
CREATE INDEX idx_cycle_count_lines_item_id         ON cycle_count_lines(item_id);

ALTER TABLE cycle_count_lines ENABLE ROW LEVEL SECURITY;

-- Managers: full access
CREATE POLICY "Managers can manage cycle_count_lines"
  ON cycle_count_lines FOR ALL
  TO authenticated
  USING (is_manager())
  WITH CHECK (is_manager());

-- Authenticated: read-only
CREATE POLICY "Authenticated users can view cycle_count_lines"
  ON cycle_count_lines FOR SELECT
  TO authenticated USING (true);

-- ============================================================================
-- 3. RPC: finalize_cycle_count(p_cycle_count_id BIGINT) RETURNS JSONB
-- ============================================================================
-- Manager-only. Locks the draft count row, snapshots current stock into
-- quantity_system, applies adjustments for lines where quantity_counted differs,
-- and marks the count finalized. Mirrors confirm_receipt conventions exactly.
-- ============================================================================

CREATE OR REPLACE FUNCTION finalize_cycle_count(
  p_cycle_count_id BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  -- Count row state
  v_count_status   TEXT;
  v_location_id    BIGINT;

  -- Loop variables
  v_line           RECORD;
  v_current_qty    INTEGER;

  -- Counters
  v_lines_adjusted  INTEGER := 0;
  v_lines_unchanged INTEGER := 0;
BEGIN
  -- ── Manager check (mirrors confirm_receipt) ───────────────────────────────
  IF NOT is_manager() THEN
    RAISE EXCEPTION 'Insufficient permissions to finalize cycle counts';
  END IF;

  -- ── Guard: count must exist and be draft ──────────────────────────────────
  SELECT status, location_id
  INTO   v_count_status, v_location_id
  FROM   cycle_counts
  WHERE  id = p_cycle_count_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cycle count % does not exist', p_cycle_count_id;
  END IF;

  IF v_count_status <> 'draft' THEN
    RAISE EXCEPTION
      'Cycle count % is not in draft status (current: %)',
      p_cycle_count_id, v_count_status;
  END IF;

  -- ── Process each counted line ─────────────────────────────────────────────
  FOR v_line IN
    SELECT id, item_id, quantity_counted
    FROM   cycle_count_lines
    WHERE  cycle_count_id = p_cycle_count_id
      AND  quantity_counted IS NOT NULL   -- skip uncounted lines
  LOOP
    -- Snapshot current stock (pre-adjustment) at the count location
    SELECT COALESCE(quantity, 0)
    INTO   v_current_qty
    FROM   stock_levels
    WHERE  location_id = v_location_id
      AND  item_id     = v_line.item_id;

    v_current_qty := COALESCE(v_current_qty, 0);

    -- Save the snapshot on the line (quantity_system)
    UPDATE cycle_count_lines
    SET    quantity_system = v_current_qty
    WHERE  id = v_line.id;

    -- Only adjust when the count differs from current stock
    IF v_line.quantity_counted <> v_current_qty THEN
      -- Upsert stock to the counted quantity
      INSERT INTO stock_levels (location_id, item_id, quantity, updated_at)
      VALUES (v_location_id, v_line.item_id, v_line.quantity_counted, now())
      ON CONFLICT (location_id, item_id)
      DO UPDATE SET
        quantity   = v_line.quantity_counted,
        updated_at = now();

      -- Write adjust ledger row following the adjust_inventory convention:
      -- quantity = ABS(delta); increase → to_location set, decrease → from_location set
      INSERT INTO inventory_movements
        (movement_type, from_location_id, to_location_id, item_id, quantity,
         actor_id, reference_type, reference_id, notes, created_at)
      VALUES
        ('adjust',
         CASE WHEN v_line.quantity_counted < v_current_qty THEN v_location_id ELSE NULL END,
         CASE WHEN v_line.quantity_counted > v_current_qty THEN v_location_id ELSE NULL END,
         v_line.item_id,
         ABS(v_line.quantity_counted - v_current_qty),
         auth.uid(), 'cycle_count', p_cycle_count_id,
         'Cycle count adjustment', now());

      v_lines_adjusted := v_lines_adjusted + 1;
    ELSE
      v_lines_unchanged := v_lines_unchanged + 1;
    END IF;
  END LOOP;

  -- ── Mark count finalized ──────────────────────────────────────────────────
  UPDATE cycle_counts
  SET    status       = 'finalized',
         finalized_at = now()
  WHERE  id = p_cycle_count_id;

  -- ── Return result ─────────────────────────────────────────────────────────
  RETURN jsonb_build_object(
    'success',          true,
    'cycle_count_id',   p_cycle_count_id,
    'lines_adjusted',   v_lines_adjusted,
    'lines_unchanged',  v_lines_unchanged
  );
END;
$$;

-- Grant to authenticated (manager check is inside the function)
GRANT  EXECUTE ON FUNCTION finalize_cycle_count(BIGINT) TO authenticated;
REVOKE EXECUTE ON FUNCTION finalize_cycle_count(BIGINT) FROM PUBLIC, anon;
