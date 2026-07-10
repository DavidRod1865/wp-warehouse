-- Inventory Core: locations, items, stock_levels, inventory_movements
-- First-party tables replacing Sortly for core inventory tracking
-- Supports warehouse areas, trucks, and job sites with full transaction ledger

-- ============================================================================
-- 1. LOCATIONS TABLE
-- ============================================================================

CREATE TABLE locations (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  location_type TEXT NOT NULL,
  parent_location_id BIGINT REFERENCES locations(id) ON DELETE RESTRICT,
  address JSONB,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT location_type_valid CHECK (location_type IN ('warehouse_area', 'truck', 'job_site'))
);

COMMENT ON TABLE locations IS 'Physical locations for inventory: warehouse areas, trucks, job sites';
COMMENT ON COLUMN locations.location_type IS 'Type of location: warehouse_area, truck, or job_site';
COMMENT ON COLUMN locations.parent_location_id IS 'Hierarchy support (e.g., truck under warehouse fleet, areas under warehouse)';
COMMENT ON COLUMN locations.address IS 'JSONB: street, city, state, zip, notes for job sites';

CREATE INDEX idx_locations_type ON locations(location_type);
CREATE INDEX idx_locations_is_active ON locations(is_active);
CREATE INDEX idx_locations_parent ON locations(parent_location_id);

ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can view, insert, update all locations"
  ON locations
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('warehouse_manager', 'admin', 'apm')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('warehouse_manager', 'admin', 'apm')
    )
  );

CREATE POLICY "Authenticated users can view locations"
  ON locations FOR SELECT
  TO authenticated USING (true);

-- ============================================================================
-- 2. ITEMS TABLE
-- ============================================================================

CREATE TABLE items (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  part_number TEXT,
  description TEXT,
  unit_cost NUMERIC(12, 2),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE items IS 'Inventory items (equipment, materials, tools)';
COMMENT ON COLUMN items.part_number IS 'Optional part number for matching/searching';
COMMENT ON COLUMN items.unit_cost IS 'Cost per unit for valuation (optional)';

CREATE INDEX idx_items_name_lower ON items(LOWER(name));
CREATE INDEX idx_items_part_number ON items(part_number);

ALTER TABLE items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can view, insert, update all items"
  ON items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('warehouse_manager', 'admin', 'apm')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('warehouse_manager', 'admin', 'apm')
    )
  );

CREATE POLICY "Authenticated users can view items"
  ON items FOR SELECT
  TO authenticated USING (true);

-- ============================================================================
-- 3. STOCK_LEVELS TABLE
-- ============================================================================

CREATE TABLE stock_levels (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  location_id BIGINT NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
  item_id BIGINT NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT quantity_non_negative CHECK (quantity >= 0),
  CONSTRAINT unique_location_item UNIQUE (location_id, item_id)
);

COMMENT ON TABLE stock_levels IS 'Current inventory quantity at each location';
COMMENT ON COLUMN stock_levels.quantity IS 'Non-negative quantity; use inventory_movements for transaction ledger';
COMMENT ON COLUMN stock_levels.updated_at IS 'Last update timestamp (auto-managed)';

CREATE INDEX idx_stock_location ON stock_levels(location_id);
CREATE INDEX idx_stock_item ON stock_levels(item_id);

ALTER TABLE stock_levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can SELECT stock_levels"
  ON stock_levels FOR SELECT
  TO authenticated USING (true);

-- Explicitly block INSERT/UPDATE/DELETE on stock_levels; mutations via RPC only
CREATE POLICY "Block INSERT on stock_levels"
  ON stock_levels FOR INSERT
  TO authenticated WITH CHECK (false);

CREATE POLICY "Block UPDATE on stock_levels"
  ON stock_levels FOR UPDATE
  TO authenticated USING (false);

CREATE POLICY "Block DELETE on stock_levels"
  ON stock_levels FOR DELETE
  TO authenticated USING (false);

-- ============================================================================
-- 4. INVENTORY_MOVEMENTS TABLE (immutable ledger)
-- ============================================================================

CREATE TABLE inventory_movements (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  movement_type TEXT NOT NULL,
  from_location_id BIGINT REFERENCES locations(id) ON DELETE SET NULL,
  to_location_id BIGINT REFERENCES locations(id) ON DELETE SET NULL,
  item_id BIGINT NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reference_type TEXT,
  reference_id BIGINT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT movement_type_valid CHECK (movement_type IN ('receive', 'transfer', 'load_truck', 'deliver', 'adjust')),
  CONSTRAINT quantity_positive CHECK (quantity > 0),
  CONSTRAINT at_least_one_location CHECK (from_location_id IS NOT NULL OR to_location_id IS NOT NULL)
);

COMMENT ON TABLE inventory_movements IS 'Immutable transaction ledger for all inventory movements';
COMMENT ON COLUMN inventory_movements.movement_type IS 'Type: receive, transfer, load_truck, deliver, adjust';
COMMENT ON COLUMN inventory_movements.from_location_id IS 'Source location (NULL for receipts or negative adjustments)';
COMMENT ON COLUMN inventory_movements.to_location_id IS 'Destination location (NULL for removals/negative adjustments)';
COMMENT ON COLUMN inventory_movements.quantity IS 'Amount moved (always positive; sign interpretation depends on movement_type)';
COMMENT ON COLUMN inventory_movements.actor_id IS 'User who performed the movement (NULL for system)';
COMMENT ON COLUMN inventory_movements.reference_type IS 'Optional external reference (e.g., "delivery", "purchase_order")';
COMMENT ON COLUMN inventory_movements.reference_id IS 'Optional external reference ID';

CREATE INDEX idx_inventory_movements_item ON inventory_movements(item_id, created_at DESC);
CREATE INDEX idx_inventory_movements_reference ON inventory_movements(reference_type, reference_id);
CREATE INDEX idx_inventory_movements_from_location ON inventory_movements(from_location_id);
CREATE INDEX idx_inventory_movements_to_location ON inventory_movements(to_location_id);
CREATE INDEX idx_inventory_movements_actor ON inventory_movements(actor_id);
CREATE INDEX idx_inventory_movements_created ON inventory_movements(created_at DESC);

ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can SELECT inventory_movements"
  ON inventory_movements FOR SELECT
  TO authenticated USING (true);

-- Explicitly block all writes to inventory_movements; ledger is append-only via RPC
CREATE POLICY "Block INSERT on inventory_movements"
  ON inventory_movements FOR INSERT
  TO authenticated WITH CHECK (false);

CREATE POLICY "Block UPDATE on inventory_movements"
  ON inventory_movements FOR UPDATE
  TO authenticated USING (false);

CREATE POLICY "Block DELETE on inventory_movements"
  ON inventory_movements FOR DELETE
  TO authenticated USING (false);

-- ============================================================================
-- 5. RPC: MOVE_INVENTORY
-- ============================================================================

CREATE OR REPLACE FUNCTION move_inventory(
  p_item_id BIGINT,
  p_quantity INTEGER,
  p_movement_type TEXT,
  p_from_location_id BIGINT DEFAULT NULL,
  p_to_location_id BIGINT DEFAULT NULL,
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id BIGINT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_is_manager BOOLEAN;
  v_source_quantity INTEGER;
  v_dest_quantity INTEGER;
  v_movement_id BIGINT;
  v_result JSONB;
BEGIN
  -- Verify caller is a manager
  SELECT EXISTS(
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role IN ('warehouse_manager', 'admin', 'apm')
  ) INTO v_is_manager;

  IF NOT v_is_manager THEN
    RAISE EXCEPTION 'Insufficient permissions to perform inventory movements';
  END IF;

  -- Validate inputs
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be positive';
  END IF;

  IF p_movement_type NOT IN ('receive', 'transfer', 'load_truck', 'deliver', 'adjust') THEN
    RAISE EXCEPTION 'Invalid movement_type: %', p_movement_type;
  END IF;

  IF p_from_location_id IS NULL AND p_to_location_id IS NULL THEN
    RAISE EXCEPTION 'At least one of from_location_id or to_location_id must be provided';
  END IF;

  -- Decrement source location if provided
  -- Lock the row first so concurrent moves can't both pass the availability check,
  -- and so insufficient stock surfaces as a friendly error rather than a CHECK violation
  IF p_from_location_id IS NOT NULL THEN
    SELECT quantity INTO v_source_quantity
    FROM stock_levels
    WHERE location_id = p_from_location_id AND item_id = p_item_id
    FOR UPDATE;

    IF v_source_quantity IS NULL OR v_source_quantity < p_quantity THEN
      RAISE EXCEPTION 'Insufficient stock at source location (available: %, requested: %)',
        COALESCE(v_source_quantity, 0), p_quantity;
    END IF;

    UPDATE stock_levels
    SET quantity = quantity - p_quantity, updated_at = now()
    WHERE location_id = p_from_location_id AND item_id = p_item_id
    RETURNING quantity INTO v_source_quantity;
  END IF;

  -- Increment destination location if provided (upsert)
  IF p_to_location_id IS NOT NULL THEN
    INSERT INTO stock_levels (location_id, item_id, quantity, updated_at)
    VALUES (p_to_location_id, p_item_id, p_quantity, now())
    ON CONFLICT (location_id, item_id)
    DO UPDATE SET
      quantity = stock_levels.quantity + p_quantity,
      updated_at = now()
    RETURNING quantity INTO v_dest_quantity;
  END IF;

  -- Insert ledger entry
  INSERT INTO inventory_movements
    (movement_type, from_location_id, to_location_id, item_id, quantity, actor_id, reference_type, reference_id, notes, created_at)
  VALUES
    (p_movement_type, p_from_location_id, p_to_location_id, p_item_id, p_quantity, auth.uid(), p_reference_type, p_reference_id, p_notes, now())
  RETURNING id INTO v_movement_id;

  -- Return success response
  v_result := jsonb_build_object(
    'success', true,
    'movement_id', v_movement_id,
    'from_location_id', p_from_location_id,
    'to_location_id', p_to_location_id,
    'item_id', p_item_id,
    'quantity', p_quantity,
    'source_quantity_after', v_source_quantity,
    'dest_quantity_after', v_dest_quantity
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION move_inventory(BIGINT, INTEGER, TEXT, BIGINT, BIGINT, TEXT, BIGINT, TEXT) TO authenticated;

-- ============================================================================
-- 6. RPC: ADJUST_INVENTORY
-- ============================================================================

CREATE OR REPLACE FUNCTION adjust_inventory(
  p_location_id BIGINT,
  p_item_id BIGINT,
  p_new_quantity INTEGER,
  p_reason TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_is_manager BOOLEAN;
  v_current_quantity INTEGER;
  v_delta INTEGER;
  v_movement_id BIGINT;
  v_result JSONB;
BEGIN
  -- Verify caller is a manager
  SELECT EXISTS(
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role IN ('warehouse_manager', 'admin', 'apm')
  ) INTO v_is_manager;

  IF NOT v_is_manager THEN
    RAISE EXCEPTION 'Insufficient permissions to adjust inventory';
  END IF;

  -- Validate inputs
  IF p_new_quantity < 0 THEN
    RAISE EXCEPTION 'New quantity cannot be negative';
  END IF;

  -- Get current quantity; SELECT INTO leaves the variable NULL when no row
  -- matches, so the missing-row case must be coalesced after the fact
  SELECT quantity INTO v_current_quantity
  FROM stock_levels
  WHERE location_id = p_location_id AND item_id = p_item_id
  FOR UPDATE;

  v_current_quantity := COALESCE(v_current_quantity, 0);

  -- Calculate delta
  v_delta := p_new_quantity - v_current_quantity;

  -- If no change, return success without ledger entry
  IF v_delta = 0 THEN
    v_result := jsonb_build_object(
      'success', true,
      'adjusted', false,
      'location_id', p_location_id,
      'item_id', p_item_id,
      'quantity_before', v_current_quantity,
      'quantity_after', p_new_quantity
    );
    RETURN v_result;
  END IF;

  -- Upsert stock_levels to new quantity
  INSERT INTO stock_levels (location_id, item_id, quantity, updated_at)
  VALUES (p_location_id, p_item_id, p_new_quantity, now())
  ON CONFLICT (location_id, item_id)
  DO UPDATE SET
    quantity = p_new_quantity,
    updated_at = now();

  -- Create ledger entry: positive delta → to_location, negative delta → from_location
  INSERT INTO inventory_movements
    (movement_type, from_location_id, to_location_id, item_id, quantity, actor_id, reference_type, notes, created_at)
  VALUES
    (
      'adjust',
      CASE WHEN v_delta < 0 THEN p_location_id ELSE NULL END,
      CASE WHEN v_delta > 0 THEN p_location_id ELSE NULL END,
      p_item_id,
      ABS(v_delta),
      auth.uid(),
      NULL,
      CASE WHEN p_notes IS NULL OR p_notes = '' THEN p_reason ELSE p_reason || ': ' || p_notes END,
      now()
    )
  RETURNING id INTO v_movement_id;

  -- Return success response
  v_result := jsonb_build_object(
    'success', true,
    'adjusted', true,
    'movement_id', v_movement_id,
    'location_id', p_location_id,
    'item_id', p_item_id,
    'quantity_before', v_current_quantity,
    'quantity_after', p_new_quantity,
    'delta', v_delta
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION adjust_inventory(BIGINT, BIGINT, INTEGER, TEXT, TEXT) TO authenticated;

-- Postgres grants EXECUTE to PUBLIC by default on new functions; restrict the
-- RPCs to signed-in users only (they additionally enforce manager role internally)
REVOKE EXECUTE ON FUNCTION move_inventory(BIGINT, INTEGER, TEXT, BIGINT, BIGINT, TEXT, BIGINT, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION adjust_inventory(BIGINT, BIGINT, INTEGER, TEXT, TEXT) FROM PUBLIC, anon;
