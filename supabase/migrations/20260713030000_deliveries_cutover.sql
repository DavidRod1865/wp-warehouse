-- Phase 5a: Deliveries cutover — off Sortly, onto first-party inventory
-- Adds truck_location_id + from_location_ref linkage, generates delivery
-- numbers in the database, and provides atomic RPCs for create / update /
-- cancel / confirm.

-- ============================================================================
-- 1. ALTER deliveries — add first-party location columns
-- ============================================================================

ALTER TABLE deliveries
  ADD COLUMN IF NOT EXISTS truck_location_id BIGINT REFERENCES locations(id),
  ADD COLUMN IF NOT EXISTS from_location_ref  BIGINT REFERENCES locations(id),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

COMMENT ON COLUMN deliveries.truck_location_id IS
  'Phase 5+ truck location (locations table). Replaces truck_sortly_folder_id for new rows.';
COMMENT ON COLUMN deliveries.from_location_ref IS
  'Phase 5+ source warehouse location (locations table). Replaces from_location_id (Sortly) for new rows.';

CREATE INDEX IF NOT EXISTS idx_deliveries_truck_location_id
  ON deliveries(truck_location_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_from_location_ref
  ON deliveries(from_location_ref);

-- ============================================================================
-- 2. ALTER delivery_items — add item_id linkage
-- ============================================================================

ALTER TABLE delivery_items
  ADD COLUMN IF NOT EXISTS item_id BIGINT REFERENCES items(id);

COMMENT ON COLUMN delivery_items.item_id IS
  'Phase 5+ inventory item (items table). Null for legacy Sortly rows.';

CREATE INDEX IF NOT EXISTS idx_delivery_items_item_id
  ON delivery_items(item_id);

-- ============================================================================
-- 3. Ensure UNIQUE constraint on deliveries.delivery_number
-- ============================================================================

DO $$
BEGIN
  -- Check whether a unique constraint already exists on delivery_number
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_constraint c
    JOIN   pg_class      t ON t.oid = c.conrelid
    JOIN   pg_namespace  n ON n.oid = t.relnamespace
    WHERE  t.relname  = 'deliveries'
      AND  n.nspname  = 'public'
      AND  c.contype  = 'u'
      AND  c.conname LIKE '%delivery_number%'
  ) AND NOT EXISTS (
    -- Also check unique indexes that are not constraint-backed
    SELECT 1
    FROM   pg_index     i
    JOIN   pg_class     t ON t.oid = i.indrelid
    JOIN   pg_namespace n ON n.oid = t.relnamespace
    JOIN   pg_class     x ON x.oid = i.indexrelid
    WHERE  t.relname  = 'deliveries'
      AND  n.nspname  = 'public'
      AND  i.indisunique = true
      AND  x.relname LIKE '%delivery_number%'
  ) THEN
    ALTER TABLE deliveries ADD CONSTRAINT deliveries_delivery_number_unique
      UNIQUE (delivery_number);
  END IF;
END;
$$;

-- ============================================================================
-- 4. Function: generate_delivery_number()
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_delivery_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_prefix   TEXT;
  v_max_seq  INTEGER;
  v_next_seq INTEGER;
BEGIN
  -- Advisory lock so concurrent creates serialize here
  PERFORM pg_advisory_xact_lock(8675309); -- constant; any large int works

  -- Build today's prefix: WP-MMDDYY
  v_prefix := 'WP-' || to_char(now() AT TIME ZONE 'America/New_York', 'MMDDYY');

  -- Find the highest sequence number used today
  SELECT COALESCE(
    MAX(
      NULLIF(
        split_part(delivery_number, '-', 3),
        ''
      )::INTEGER
    ),
    0
  )
  INTO v_max_seq
  FROM deliveries
  WHERE delivery_number LIKE v_prefix || '-%'
    AND created_at >= date_trunc('day', now() AT TIME ZONE 'America/New_York')
                      AT TIME ZONE 'America/New_York';

  v_next_seq := v_max_seq + 1;

  RETURN v_prefix || '-' || lpad(v_next_seq::TEXT, 2, '0');
END;
$$;

GRANT  EXECUTE ON FUNCTION generate_delivery_number() TO authenticated;
REVOKE EXECUTE ON FUNCTION generate_delivery_number() FROM PUBLIC, anon;

-- ============================================================================
-- 5. Helper: is_manager() — reuse across all RPCs in this migration
-- ============================================================================

-- This function may already exist from earlier migrations; CREATE OR REPLACE
-- is safe.
CREATE OR REPLACE FUNCTION is_manager()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
      AND role IN ('warehouse_manager', 'admin', 'apm')
  );
$$;

GRANT  EXECUTE ON FUNCTION is_manager() TO authenticated;
REVOKE EXECUTE ON FUNCTION is_manager() FROM PUBLIC, anon;

-- ============================================================================
-- 6. RPC: create_delivery(p JSONB) RETURNS JSONB
-- ============================================================================

CREATE OR REPLACE FUNCTION create_delivery(p JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_delivery_id        BIGINT;
  v_delivery_number    TEXT;
  v_project_id         BIGINT;
  v_driver_id          UUID;
  v_truck_location_id  BIGINT;
  v_from_location_id   BIGINT;
  v_status             TEXT;
  v_from_address       JSONB;
  v_to_address         JSONB;
  v_po_reference       TEXT;
  v_notes              TEXT;

  -- Stock / ledger loop variables
  v_item_obj           JSONB;
  v_item_id            BIGINT;
  v_item_name          TEXT;
  v_item_qty           INTEGER;
  v_item_notes         TEXT;
  v_current_stock      INTEGER;
  v_truck_name         TEXT;

  -- Activity log seed
  v_activity_log       JSONB;
BEGIN
  -- Manager check
  IF NOT is_manager() THEN
    RAISE EXCEPTION 'Insufficient permissions to create deliveries';
  END IF;

  -- Extract scalar inputs
  v_project_id        := (p->>'project_id')::BIGINT;
  v_driver_id         := (p->>'driver_id')::UUID;
  v_truck_location_id := (p->>'truck_location_id')::BIGINT;
  v_from_location_id  := (p->>'from_location_id')::BIGINT;
  v_status            := COALESCE(p->>'status', 'draft');
  v_from_address      := p->'from_address';
  v_to_address        := p->'to_address';
  v_po_reference      := p->>'po_reference';
  v_notes             := p->>'notes';

  -- Validate required fields
  IF v_truck_location_id IS NULL THEN
    RAISE EXCEPTION 'truck_location_id is required';
  END IF;
  IF v_from_location_id IS NULL THEN
    RAISE EXCEPTION 'from_location_id is required';
  END IF;
  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'project_id is required';
  END IF;
  IF p->'items' IS NULL OR jsonb_array_length(p->'items') = 0 THEN
    RAISE EXCEPTION 'At least one item is required';
  END IF;

  -- Lookup truck name for denormalization
  SELECT name INTO v_truck_name
  FROM locations
  WHERE id = v_truck_location_id AND location_type = 'truck';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Truck location % not found or not of type truck', v_truck_location_id;
  END IF;

  -- Generate delivery number (advisory lock inside the function)
  v_delivery_number := generate_delivery_number();

  -- Activity log seed
  v_activity_log := jsonb_build_array(
    jsonb_build_object(
      'timestamp',   now(),
      'action',      'created',
      'user_id',     auth.uid(),
      'details',     jsonb_build_object(
        'items_count',    jsonb_array_length(p->'items'),
        'delivery_type',  'commercial',
        'truck_name',     v_truck_name
      )
    )
  );

  -- Insert delivery row
  INSERT INTO deliveries (
    delivery_number,
    po_reference,
    project_id,
    driver_id,
    status,
    from_address,
    to_address,
    from_location_ref,
    truck_location_id,
    truck_name,
    delivery_type,
    activity_log,
    created_by
  ) VALUES (
    v_delivery_number,
    NULLIF(v_po_reference, ''),
    v_project_id,
    v_driver_id,
    v_status,
    v_from_address,
    v_to_address,
    v_from_location_id,
    v_truck_location_id,
    v_truck_name,
    'commercial',
    v_activity_log,
    auth.uid()
  )
  RETURNING id INTO v_delivery_id;

  -- Process each item: stock check + move + delivery_items insert
  FOR v_item_obj IN SELECT jsonb_array_elements(p->'items')
  LOOP
    v_item_id    := (v_item_obj->>'item_id')::BIGINT;
    v_item_name  := v_item_obj->>'item_name';
    v_item_qty   := (v_item_obj->>'quantity')::INTEGER;
    v_item_notes := v_item_obj->>'notes';

    IF v_item_qty IS NULL OR v_item_qty <= 0 THEN
      RAISE EXCEPTION 'Quantity must be positive for item "%"', v_item_name;
    END IF;

    -- Stock movement for tracked items only (item_id present)
    IF v_item_id IS NOT NULL THEN
      -- Lock the source stock row and check availability
      SELECT quantity INTO v_current_stock
      FROM stock_levels
      WHERE location_id = v_from_location_id AND item_id = v_item_id
      FOR UPDATE;

      v_current_stock := COALESCE(v_current_stock, 0);

      IF v_current_stock < v_item_qty THEN
        RAISE EXCEPTION
          'Insufficient stock for "%": have %, need %',
          v_item_name, v_current_stock, v_item_qty;
      END IF;

      -- Decrement from source
      UPDATE stock_levels
      SET    quantity   = quantity - v_item_qty,
             updated_at = now()
      WHERE  location_id = v_from_location_id AND item_id = v_item_id;

      -- Increment on truck (upsert)
      INSERT INTO stock_levels (location_id, item_id, quantity, updated_at)
      VALUES (v_truck_location_id, v_item_id, v_item_qty, now())
      ON CONFLICT (location_id, item_id)
      DO UPDATE SET
        quantity   = stock_levels.quantity + v_item_qty,
        updated_at = now();

      -- Ledger entry
      INSERT INTO inventory_movements
        (movement_type, from_location_id, to_location_id, item_id, quantity,
         actor_id, reference_type, reference_id, notes, created_at)
      VALUES
        ('load_truck', v_from_location_id, v_truck_location_id, v_item_id, v_item_qty,
         auth.uid(), 'delivery', v_delivery_id, v_item_notes, now());
    END IF;

    -- Insert delivery_items row
    INSERT INTO delivery_items
      (delivery_id, item_id, item_name, quantity, delivered_quantity, remaining_quantity, notes)
    VALUES
      (v_delivery_id, v_item_id, v_item_name, v_item_qty, 0, v_item_qty, v_item_notes);
  END LOOP;

  RETURN jsonb_build_object(
    'success',          true,
    'delivery_id',      v_delivery_id,
    'delivery_number',  v_delivery_number
  );
END;
$$;

GRANT  EXECUTE ON FUNCTION create_delivery(JSONB) TO authenticated;
REVOKE EXECUTE ON FUNCTION create_delivery(JSONB) FROM PUBLIC, anon;

-- ============================================================================
-- 7. RPC: update_delivery_items(p_delivery_id BIGINT, p_items JSONB)
-- ============================================================================

CREATE OR REPLACE FUNCTION update_delivery_items(
  p_delivery_id BIGINT,
  p_items       JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_status             TEXT;
  v_truck_location_id  BIGINT;
  v_from_location_id   BIGINT;

  -- Existing item cursor
  v_existing           RECORD;

  -- New item loop
  v_new_obj            JSONB;
  v_item_id            BIGINT;
  v_item_name          TEXT;
  v_new_qty            INTEGER;
  v_item_notes         TEXT;

  -- Existing item lookup
  v_existing_qty       INTEGER;
  v_delta              INTEGER;
  v_current_stock      INTEGER;

  v_added              INTEGER := 0;
  v_removed            INTEGER := 0;
  v_adjusted           INTEGER := 0;
BEGIN
  IF NOT is_manager() THEN
    RAISE EXCEPTION 'Insufficient permissions to update delivery items';
  END IF;

  -- Lock delivery row + validate status
  SELECT status, truck_location_id, from_location_ref
  INTO   v_status, v_truck_location_id, v_from_location_id
  FROM   deliveries
  WHERE  id = p_delivery_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Delivery % not found', p_delivery_id;
  END IF;

  IF v_status NOT IN ('draft', 'pending') THEN
    RAISE EXCEPTION 'Cannot edit delivery in status "%"', v_status;
  END IF;

  -- ── Build a temp set of incoming item_ids for diff ──────────────────────
  -- We use a CTE-style approach via a temporary table approach inside plpgsql.
  -- Simpler: iterate existing items, look them up in the new array by item_id.

  -- ── REMOVED ITEMS: exist in delivery_items but not in p_items ───────────
  FOR v_existing IN
    SELECT di.id, di.item_id, di.item_name, di.quantity
    FROM   delivery_items di
    WHERE  di.delivery_id = p_delivery_id
      AND  di.item_id IS NOT NULL
  LOOP
    -- Check if this item_id appears in p_items
    IF NOT EXISTS (
      SELECT 1
      FROM   jsonb_array_elements(p_items) AS e
      WHERE  (e->>'item_id')::BIGINT = v_existing.item_id
    ) THEN
      -- Return stock: truck → from_location
      SELECT quantity INTO v_current_stock
      FROM   stock_levels
      WHERE  location_id = v_truck_location_id AND item_id = v_existing.item_id
      FOR UPDATE;

      -- Decrement truck (don't go below 0)
      UPDATE stock_levels
      SET    quantity   = GREATEST(quantity - v_existing.quantity, 0),
             updated_at = now()
      WHERE  location_id = v_truck_location_id AND item_id = v_existing.item_id;

      -- Return to source
      INSERT INTO stock_levels (location_id, item_id, quantity, updated_at)
      VALUES (v_from_location_id, v_existing.item_id, v_existing.quantity, now())
      ON CONFLICT (location_id, item_id)
      DO UPDATE SET
        quantity   = stock_levels.quantity + v_existing.quantity,
        updated_at = now();

      INSERT INTO inventory_movements
        (movement_type, from_location_id, to_location_id, item_id, quantity,
         actor_id, reference_type, reference_id, notes, created_at)
      VALUES
        ('transfer', v_truck_location_id, v_from_location_id, v_existing.item_id,
         v_existing.quantity, auth.uid(), 'delivery', p_delivery_id,
         'Item removed from delivery', now());

      v_removed := v_removed + 1;
    END IF;
  END LOOP;

  -- ── ADDED / QUANTITY-CHANGED ITEMS ───────────────────────────────────────
  FOR v_new_obj IN SELECT jsonb_array_elements(p_items)
  LOOP
    v_item_id    := (v_new_obj->>'item_id')::BIGINT;
    v_item_name  := v_new_obj->>'item_name';
    v_new_qty    := (v_new_obj->>'quantity')::INTEGER;
    v_item_notes := v_new_obj->>'notes';

    IF v_new_qty IS NULL OR v_new_qty <= 0 THEN
      RAISE EXCEPTION 'Quantity must be positive for "%"', v_item_name;
    END IF;

    IF v_item_id IS NOT NULL THEN
      -- Check existing quantity on this delivery
      SELECT quantity INTO v_existing_qty
      FROM   delivery_items
      WHERE  delivery_id = p_delivery_id AND item_id = v_item_id;

      IF NOT FOUND THEN
        -- NEW ITEM: move from_location → truck
        SELECT quantity INTO v_current_stock
        FROM   stock_levels
        WHERE  location_id = v_from_location_id AND item_id = v_item_id
        FOR UPDATE;

        v_current_stock := COALESCE(v_current_stock, 0);
        IF v_current_stock < v_new_qty THEN
          RAISE EXCEPTION
            'Insufficient stock for "%": have %, need %',
            v_item_name, v_current_stock, v_new_qty;
        END IF;

        UPDATE stock_levels
        SET    quantity   = quantity - v_new_qty,
               updated_at = now()
        WHERE  location_id = v_from_location_id AND item_id = v_item_id;

        INSERT INTO stock_levels (location_id, item_id, quantity, updated_at)
        VALUES (v_truck_location_id, v_item_id, v_new_qty, now())
        ON CONFLICT (location_id, item_id)
        DO UPDATE SET quantity = stock_levels.quantity + v_new_qty, updated_at = now();

        INSERT INTO inventory_movements
          (movement_type, from_location_id, to_location_id, item_id, quantity,
           actor_id, reference_type, reference_id, notes, created_at)
        VALUES
          ('load_truck', v_from_location_id, v_truck_location_id, v_item_id,
           v_new_qty, auth.uid(), 'delivery', p_delivery_id, v_item_notes, now());

        v_added := v_added + 1;

      ELSIF v_new_qty <> v_existing_qty THEN
        -- QUANTITY CHANGE: move delta in the correct direction
        v_delta := v_new_qty - v_existing_qty;

        IF v_delta > 0 THEN
          -- Needs more from source
          SELECT quantity INTO v_current_stock
          FROM   stock_levels
          WHERE  location_id = v_from_location_id AND item_id = v_item_id
          FOR UPDATE;

          v_current_stock := COALESCE(v_current_stock, 0);
          IF v_current_stock < v_delta THEN
            RAISE EXCEPTION
              'Insufficient stock for "%": have %, need additional %',
              v_item_name, v_current_stock, v_delta;
          END IF;

          UPDATE stock_levels
          SET    quantity   = quantity - v_delta, updated_at = now()
          WHERE  location_id = v_from_location_id AND item_id = v_item_id;

          INSERT INTO stock_levels (location_id, item_id, quantity, updated_at)
          VALUES (v_truck_location_id, v_item_id, v_delta, now())
          ON CONFLICT (location_id, item_id)
          DO UPDATE SET quantity = stock_levels.quantity + v_delta, updated_at = now();

          INSERT INTO inventory_movements
            (movement_type, from_location_id, to_location_id, item_id, quantity,
             actor_id, reference_type, reference_id, notes, created_at)
          VALUES
            ('load_truck', v_from_location_id, v_truck_location_id, v_item_id,
             v_delta, auth.uid(), 'delivery', p_delivery_id,
             'Quantity increased', now());
        ELSE
          -- Return excess from truck to source
          v_delta := -v_delta; -- positive

          UPDATE stock_levels
          SET    quantity   = GREATEST(quantity - v_delta, 0), updated_at = now()
          WHERE  location_id = v_truck_location_id AND item_id = v_item_id;

          INSERT INTO stock_levels (location_id, item_id, quantity, updated_at)
          VALUES (v_from_location_id, v_item_id, v_delta, now())
          ON CONFLICT (location_id, item_id)
          DO UPDATE SET quantity = stock_levels.quantity + v_delta, updated_at = now();

          INSERT INTO inventory_movements
            (movement_type, from_location_id, to_location_id, item_id, quantity,
             actor_id, reference_type, reference_id, notes, created_at)
          VALUES
            ('transfer', v_truck_location_id, v_from_location_id, v_item_id,
             v_delta, auth.uid(), 'delivery', p_delivery_id,
             'Quantity decreased', now());
        END IF;

        v_adjusted := v_adjusted + 1;
      END IF;
    END IF;
  END LOOP;

  -- ── Replace delivery_items rows ──────────────────────────────────────────
  DELETE FROM delivery_items WHERE delivery_id = p_delivery_id;

  FOR v_new_obj IN SELECT jsonb_array_elements(p_items)
  LOOP
    INSERT INTO delivery_items
      (delivery_id, item_id, item_name, quantity, delivered_quantity, remaining_quantity, notes)
    VALUES (
      p_delivery_id,
      NULLIF((v_new_obj->>'item_id')::BIGINT, 0),
      v_new_obj->>'item_name',
      (v_new_obj->>'quantity')::INTEGER,
      COALESCE((v_new_obj->>'delivered_quantity')::INTEGER, 0),
      COALESCE((v_new_obj->>'remaining_quantity')::INTEGER, (v_new_obj->>'quantity')::INTEGER),
      v_new_obj->>'notes'
    );
  END LOOP;

  -- Append activity log entry
  UPDATE deliveries
  SET    activity_log = COALESCE(activity_log, '[]'::jsonb) || jsonb_build_array(
           jsonb_build_object(
             'timestamp', now(),
             'action',    'items_updated',
             'user_id',   auth.uid(),
             'details',   jsonb_build_object(
               'added',    v_added,
               'removed',  v_removed,
               'adjusted', v_adjusted
             )
           )
         ),
         updated_at = now()
  WHERE  id = p_delivery_id;

  RETURN jsonb_build_object(
    'success',   true,
    'added',     v_added,
    'removed',   v_removed,
    'adjusted',  v_adjusted
  );
END;
$$;

GRANT  EXECUTE ON FUNCTION update_delivery_items(BIGINT, JSONB) TO authenticated;
REVOKE EXECUTE ON FUNCTION update_delivery_items(BIGINT, JSONB) FROM PUBLIC, anon;

-- ============================================================================
-- 8. RPC: cancel_delivery(p_delivery_id BIGINT) RETURNS JSONB
-- ============================================================================

CREATE OR REPLACE FUNCTION cancel_delivery(p_delivery_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_status             TEXT;
  v_truck_location_id  BIGINT;
  v_from_location_id   BIGINT;
  v_item               RECORD;
BEGIN
  IF NOT is_manager() THEN
    RAISE EXCEPTION 'Insufficient permissions to cancel deliveries';
  END IF;

  -- Lock + validate
  SELECT status, truck_location_id, from_location_ref
  INTO   v_status, v_truck_location_id, v_from_location_id
  FROM   deliveries
  WHERE  id = p_delivery_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Delivery % not found', p_delivery_id;
  END IF;

  IF v_status NOT IN ('draft', 'pending') THEN
    RAISE EXCEPTION
      'Can only cancel draft or pending deliveries, current status is "%"', v_status;
  END IF;

  -- Return stock for all tracked items truck → from_location
  FOR v_item IN
    SELECT item_id, quantity
    FROM   delivery_items
    WHERE  delivery_id = p_delivery_id
      AND  item_id IS NOT NULL
  LOOP
    -- Reduce truck stock
    UPDATE stock_levels
    SET    quantity   = GREATEST(quantity - v_item.quantity, 0),
           updated_at = now()
    WHERE  location_id = v_truck_location_id AND item_id = v_item.item_id;

    -- Restore to source (upsert)
    INSERT INTO stock_levels (location_id, item_id, quantity, updated_at)
    VALUES (v_from_location_id, v_item.item_id, v_item.quantity, now())
    ON CONFLICT (location_id, item_id)
    DO UPDATE SET quantity = stock_levels.quantity + v_item.quantity, updated_at = now();

    -- Ledger
    INSERT INTO inventory_movements
      (movement_type, from_location_id, to_location_id, item_id, quantity,
       actor_id, reference_type, reference_id, notes, created_at)
    VALUES
      ('transfer', v_truck_location_id, v_from_location_id, v_item.item_id,
       v_item.quantity, auth.uid(), 'delivery', p_delivery_id,
       'Delivery cancelled — stock returned', now());
  END LOOP;

  -- Update delivery status
  UPDATE deliveries
  SET status       = 'cancelled',
      activity_log = COALESCE(activity_log, '[]'::jsonb) || jsonb_build_array(
        jsonb_build_object(
          'timestamp', now(),
          'action',    'cancelled',
          'user_id',   auth.uid(),
          'details',   jsonb_build_object('previous_status', v_status)
        )
      ),
      updated_at   = now()
  WHERE id = p_delivery_id;

  RETURN jsonb_build_object(
    'success',     true,
    'delivery_id', p_delivery_id,
    'status',      'cancelled'
  );
END;
$$;

GRANT  EXECUTE ON FUNCTION cancel_delivery(BIGINT) TO authenticated;
REVOKE EXECUTE ON FUNCTION cancel_delivery(BIGINT) FROM PUBLIC, anon;

-- ============================================================================
-- 9. RPC: confirm_delivery(...)
-- ============================================================================

CREATE OR REPLACE FUNCTION confirm_delivery(
  p_delivery_id            BIGINT,
  p_signed_by_name         TEXT,
  p_signature_storage_path TEXT  DEFAULT NULL,
  p_notes                  TEXT  DEFAULT NULL,
  p_delivered              JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_delivery               RECORD;
  v_job_site_location_id   BIGINT;
  v_caller_is_manager      BOOLEAN;
  v_caller_is_driver       BOOLEAN;

  -- Item loop
  v_di                     RECORD;
  v_delivered_qty          INTEGER;
  v_delivered_obj          JSONB;

  v_items_moved            INTEGER := 0;
BEGIN
  -- Permission: manager OR assigned driver
  SELECT is_manager() INTO v_caller_is_manager;

  SELECT status, truck_location_id, from_location_ref, project_id, driver_id
  INTO   v_delivery
  FROM   deliveries
  WHERE  id = p_delivery_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Delivery % not found', p_delivery_id;
  END IF;

  v_caller_is_driver := (v_delivery.driver_id = auth.uid());

  IF NOT (v_caller_is_manager OR v_caller_is_driver) THEN
    RAISE EXCEPTION 'You do not have permission to confirm this delivery';
  END IF;

  IF v_delivery.status NOT IN ('pending', 'in_transit') THEN
    RAISE EXCEPTION
      'Delivery must be pending or in_transit to confirm, current status is "%"',
      v_delivery.status;
  END IF;

  -- Look up job-site location from project
  SELECT p.job_site_location_id INTO v_job_site_location_id
  FROM   projects p
  WHERE  p.id = v_delivery.project_id;

  IF v_job_site_location_id IS NULL THEN
    RAISE EXCEPTION
      'Project % has no job-site location configured. Cannot confirm delivery.',
      v_delivery.project_id;
  END IF;

  -- Process each delivery item
  FOR v_di IN
    SELECT id, item_id, item_name, quantity, remaining_quantity
    FROM   delivery_items
    WHERE  delivery_id = p_delivery_id
  LOOP
    -- Determine delivered quantity (from p_delivered if provided, else full quantity)
    v_delivered_qty := NULL;

    IF p_delivered IS NOT NULL THEN
      SELECT (e->>'delivered_quantity')::INTEGER
      INTO   v_delivered_qty
      FROM   jsonb_array_elements(p_delivered) AS e
      WHERE  (e->>'delivery_item_id')::BIGINT = v_di.id;
    END IF;

    v_delivered_qty := COALESCE(v_delivered_qty, v_di.remaining_quantity, v_di.quantity);

    IF v_delivered_qty <= 0 THEN
      CONTINUE;
    END IF;

    -- Stock movement: truck → job site (tracked items only)
    IF v_di.item_id IS NOT NULL AND v_delivery.truck_location_id IS NOT NULL THEN
      -- Reduce truck stock
      UPDATE stock_levels
      SET    quantity   = GREATEST(quantity - v_delivered_qty, 0),
             updated_at = now()
      WHERE  location_id = v_delivery.truck_location_id AND item_id = v_di.item_id;

      -- Increment at job site (upsert)
      INSERT INTO stock_levels (location_id, item_id, quantity, updated_at)
      VALUES (v_job_site_location_id, v_di.item_id, v_delivered_qty, now())
      ON CONFLICT (location_id, item_id)
      DO UPDATE SET quantity = stock_levels.quantity + v_delivered_qty, updated_at = now();

      -- Ledger
      INSERT INTO inventory_movements
        (movement_type, from_location_id, to_location_id, item_id, quantity,
         actor_id, reference_type, reference_id, notes, created_at)
      VALUES
        ('deliver', v_delivery.truck_location_id, v_job_site_location_id,
         v_di.item_id, v_delivered_qty, auth.uid(), 'delivery', p_delivery_id,
         p_notes, now());
    END IF;

    -- Update delivery_item delivered/remaining quantities
    UPDATE delivery_items
    SET delivered_quantity  = delivered_quantity + v_delivered_qty,
        remaining_quantity  = GREATEST(remaining_quantity - v_delivered_qty, 0)
    WHERE id = v_di.id;

    v_items_moved := v_items_moved + 1;
  END LOOP;

  -- Insert delivery_confirmations row
  INSERT INTO delivery_confirmations
    (delivery_id, driver_id, signed_by_name, signature_storage_path, status, notes, completed_at)
  VALUES
    (p_delivery_id, auth.uid(), p_signed_by_name, p_signature_storage_path,
     'completed', p_notes, now());

  -- Update delivery
  UPDATE deliveries
  SET status                   = 'delivered',
      delivered_at             = now(),
      signature_name           = p_signed_by_name,
      activity_log             = COALESCE(activity_log, '[]'::jsonb) || jsonb_build_array(
        jsonb_build_object(
          'timestamp', now(),
          'action',    'confirmed',
          'user_id',   auth.uid(),
          'details',   jsonb_build_object(
            'signed_by_name',  p_signed_by_name,
            'items_moved',     v_items_moved,
            'job_site_loc_id', v_job_site_location_id
          )
        )
      ),
      updated_at = now()
  WHERE id = p_delivery_id;

  RETURN jsonb_build_object(
    'success',               true,
    'delivery_id',           p_delivery_id,
    'items_moved',           v_items_moved,
    'job_site_location_id',  v_job_site_location_id
  );
END;
$$;

GRANT  EXECUTE ON FUNCTION confirm_delivery(BIGINT, TEXT, TEXT, TEXT, JSONB) TO authenticated;
REVOKE EXECUTE ON FUNCTION confirm_delivery(BIGINT, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon;

-- ============================================================================
-- 10. Storage bucket: delivery-signatures-v2 (private)
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'delivery-signatures-v2',
  'delivery-signatures-v2',
  false,
  5242880, -- 5 MB
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Drivers and managers can INSERT (upload) signatures
DROP POLICY IF EXISTS "Authenticated users can upload signatures v2" ON storage.objects;
CREATE POLICY "Authenticated users can upload signatures v2"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'delivery-signatures-v2');

-- Managers and signature owners can SELECT
DROP POLICY IF EXISTS "Managers and owners can view signatures v2" ON storage.objects;
CREATE POLICY "Managers and owners can view signatures v2"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'delivery-signatures-v2'
    AND (
      is_manager()
      OR owner = auth.uid()
    )
  );

-- Managers can DELETE
DROP POLICY IF EXISTS "Managers can delete signatures v2" ON storage.objects;
CREATE POLICY "Managers can delete signatures v2"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'delivery-signatures-v2'
    AND is_manager()
  );

-- ============================================================================
-- 11. Align legacy CHECK constraints with the commercial-only model
--     (live DB allowed project_delivery|service_delivery|direct_supplier and
--      in_progress instead of in_transit; keep legacy values for old rows)
-- ============================================================================

ALTER TABLE deliveries DROP CONSTRAINT IF EXISTS deliveries_delivery_type_check;
ALTER TABLE deliveries ADD CONSTRAINT deliveries_delivery_type_check
  CHECK (delivery_type::text = ANY (ARRAY[
    'commercial', 'project_delivery', 'service_delivery', 'direct_supplier'
  ]::text[]));

ALTER TABLE deliveries DROP CONSTRAINT IF EXISTS deliveries_status_check;
ALTER TABLE deliveries ADD CONSTRAINT deliveries_status_check
  CHECK (status::text = ANY (ARRAY[
    'draft', 'pending', 'in_transit', 'in_progress', 'partial', 'delivered', 'cancelled'
  ]::text[]));
