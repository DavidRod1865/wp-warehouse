-- Add 'return' movement type for overstock returns from project locations
-- back to the warehouse. Widens the ledger CHECK and reissues move_inventory
-- (full body from 20260710000000_create_inventory_core.sql; only the
-- movement-type validation list changes).

ALTER TABLE inventory_movements DROP CONSTRAINT movement_type_valid;
ALTER TABLE inventory_movements ADD CONSTRAINT movement_type_valid
  CHECK (movement_type IN ('receive', 'transfer', 'load_truck', 'deliver', 'adjust', 'return'));

COMMENT ON COLUMN inventory_movements.movement_type IS
  'Type: receive, transfer, load_truck, deliver, adjust, return';

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

  IF p_movement_type NOT IN ('receive', 'transfer', 'load_truck', 'deliver', 'adjust', 'return') THEN
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

-- Grants persist across CREATE OR REPLACE; reissued defensively.
GRANT EXECUTE ON FUNCTION move_inventory(BIGINT, INTEGER, TEXT, BIGINT, BIGINT, TEXT, BIGINT, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION move_inventory(BIGINT, INTEGER, TEXT, BIGINT, BIGINT, TEXT, BIGINT, TEXT) FROM PUBLIC, anon;
