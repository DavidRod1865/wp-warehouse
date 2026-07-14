-- Phase 4: Receiving ↔ Purchase Order rework
-- Adds PO linkage to receiving tables, location-based destination,
-- and confirm_receipt RPC that handles stock, PO line updates, and PO status
-- in a single atomic transaction.

-- ============================================================================
-- 1. ALTER receiving_log_entries — add PO + location columns
-- ============================================================================

ALTER TABLE receiving_log_entries
  ADD COLUMN IF NOT EXISTS po_id BIGINT REFERENCES purchase_orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS destination_location_id BIGINT REFERENCES locations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Keep legacy destination_folder_id for old rows; new code ignores it.
COMMENT ON COLUMN receiving_log_entries.po_id IS
  'Linked purchase order (optional — null for PO-less / misc receipts)';
COMMENT ON COLUMN receiving_log_entries.destination_location_id IS
  'Primary destination location (replaces Sortly destination_folder_id for Phase 4+ rows)';

CREATE INDEX IF NOT EXISTS idx_receiving_log_entries_po_id
  ON receiving_log_entries(po_id);
CREATE INDEX IF NOT EXISTS idx_receiving_log_entries_destination_location_id
  ON receiving_log_entries(destination_location_id);

-- ============================================================================
-- 2. ALTER receiving_items — add PO line + item + location columns
-- ============================================================================

ALTER TABLE receiving_items
  ADD COLUMN IF NOT EXISTS po_line_item_id BIGINT REFERENCES po_line_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS item_id BIGINT REFERENCES items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS destination_location_id BIGINT REFERENCES locations(id) ON DELETE SET NULL;

COMMENT ON COLUMN receiving_items.po_line_item_id IS
  'PO line item this receipt row satisfies (null for PO-less receipts)';
COMMENT ON COLUMN receiving_items.item_id IS
  'Inventory item created or updated (null for legacy/Sortly rows)';
COMMENT ON COLUMN receiving_items.destination_location_id IS
  'Location where stock was placed (replaces Sortly destination_folder_id)';

CREATE INDEX IF NOT EXISTS idx_receiving_items_po_line_item_id
  ON receiving_items(po_line_item_id);
CREATE INDEX IF NOT EXISTS idx_receiving_items_item_id
  ON receiving_items(item_id);
CREATE INDEX IF NOT EXISTS idx_receiving_items_destination_location_id
  ON receiving_items(destination_location_id);

-- ============================================================================
-- 3. RPC: confirm_receipt
-- ============================================================================

CREATE OR REPLACE FUNCTION confirm_receipt(
  p_entry_id BIGINT,
  p_items    JSONB,
  p_notes    TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  -- Manager check
  v_is_manager        BOOLEAN;

  -- Entry state
  v_entry_status      TEXT;
  v_entry_po_id       BIGINT;

  -- Loop variables
  v_item_obj          JSONB;
  v_po_line_id        BIGINT;
  v_item_id           BIGINT;
  v_new_item_name     TEXT;
  v_new_item_pn       TEXT;
  v_item_name_str     TEXT;
  v_part_number       TEXT;
  v_qty               INTEGER;
  v_dest_location_id  BIGINT;
  v_notes_line        TEXT;

  -- PO tracking
  v_po_id             BIGINT;
  v_new_qty_received  INTEGER;
  v_qty_ordered       INTEGER;
  v_new_recv_status   TEXT;
  v_po_status_new     TEXT;

  -- Aggregate counters
  v_items_processed   INTEGER := 0;
BEGIN
  -- ── Manager check (mirrors move_inventory exactly) ──────────────────────
  SELECT EXISTS(
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role IN ('warehouse_manager', 'admin', 'apm')
  ) INTO v_is_manager;

  IF NOT v_is_manager THEN
    RAISE EXCEPTION 'Insufficient permissions to confirm receipts';
  END IF;

  -- ── Guard: entry must exist and not already be confirmed ────────────────
  -- FOR UPDATE locks the entry row so a concurrent confirm of the same entry
  -- waits here, then fails the already-confirmed check instead of double-adding stock
  SELECT status, po_id
  INTO v_entry_status, v_entry_po_id
  FROM receiving_log_entries
  WHERE id = p_entry_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Receiving entry % does not exist', p_entry_id;
  END IF;

  IF v_entry_status = 'confirmed' THEN
    RAISE EXCEPTION 'Receiving entry % is already confirmed', p_entry_id;
  END IF;

  -- ── Process each item ────────────────────────────────────────────────────
  FOR v_item_obj IN SELECT jsonb_array_elements(p_items)
  LOOP
    -- Extract fields from the JSON element
    v_po_line_id       := (v_item_obj->>'po_line_item_id')::BIGINT;
    v_item_id          := (v_item_obj->>'item_id')::BIGINT;
    v_item_name_str    := v_item_obj->>'item_name';
    v_part_number      := v_item_obj->>'part_number';
    v_qty              := (v_item_obj->>'quantity_received')::INTEGER;
    v_dest_location_id := (v_item_obj->>'destination_location_id')::BIGINT;
    v_notes_line       := v_item_obj->>'notes';

    -- Validate quantity
    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'quantity_received must be positive for item "%"', v_item_name_str;
    END IF;

    -- Validate destination
    IF v_dest_location_id IS NULL THEN
      RAISE EXCEPTION 'destination_location_id is required for item "%"', v_item_name_str;
    END IF;

    -- ── 1. Resolve or create the inventory item ──────────────────────────
    IF v_item_id IS NULL THEN
      -- Must have new_item block
      v_new_item_name := v_item_obj->'new_item'->>'name';
      v_new_item_pn   := v_item_obj->'new_item'->>'part_number';

      IF v_new_item_name IS NULL OR trim(v_new_item_name) = '' THEN
        RAISE EXCEPTION
          'item_id is null and new_item.name is missing for item "%"', v_item_name_str;
      END IF;

      INSERT INTO items (name, part_number, created_at, updated_at)
      VALUES (trim(v_new_item_name), nullif(trim(coalesce(v_new_item_pn, '')), ''), now(), now())
      RETURNING id INTO v_item_id;
    END IF;

    -- ── 2. Upsert stock at destination location ──────────────────────────
    INSERT INTO stock_levels (location_id, item_id, quantity, updated_at)
    VALUES (v_dest_location_id, v_item_id, v_qty, now())
    ON CONFLICT (location_id, item_id)
    DO UPDATE SET
      quantity   = stock_levels.quantity + v_qty,
      updated_at = now();

    -- ── 3. Ledger movement ───────────────────────────────────────────────
    INSERT INTO inventory_movements
      (movement_type, from_location_id, to_location_id, item_id, quantity,
       actor_id, reference_type, reference_id, notes, created_at)
    VALUES
      ('receive', NULL, v_dest_location_id, v_item_id, v_qty,
       auth.uid(), 'receiving_entry', p_entry_id, v_notes_line, now());

    -- ── 4. Insert receiving_items row ────────────────────────────────────
    INSERT INTO receiving_items
      (receiving_entry_id, po_line_item_id, item_id, item_name, part_number,
       quantity_received, destination_location_id, action, notes)
    VALUES
      (p_entry_id, v_po_line_id, v_item_id, v_item_name_str, v_part_number,
       v_qty, v_dest_location_id,
       CASE WHEN v_item_obj->>'item_id' IS NOT NULL THEN 'update' ELSE 'create' END,
       v_notes_line);

    -- ── 5. Update PO line item if linked ─────────────────────────────────
    IF v_po_line_id IS NOT NULL THEN
      -- Accumulate quantity_received; back-fill item_id if blank on the line
      UPDATE po_line_items
      SET
        quantity_received = quantity_received + v_qty,
        item_id           = COALESCE(po_line_items.item_id, v_item_id),
        updated_at        = now()
      WHERE id = v_po_line_id
      RETURNING po_id, quantity_ordered, quantity_received INTO v_po_id, v_qty_ordered, v_new_qty_received;

      -- Derive received_status for this line
      v_new_recv_status := CASE
        WHEN v_new_qty_received = 0         THEN 'pending'
        WHEN v_new_qty_received < v_qty_ordered THEN 'partial'
        WHEN v_new_qty_received = v_qty_ordered THEN 'received'
        ELSE                                     'over_received'
      END;

      UPDATE po_line_items
      SET received_status = v_new_recv_status::TEXT
      WHERE id = v_po_line_id;
    END IF;

    v_items_processed := v_items_processed + 1;
  END LOOP;

  -- ── 6. Recompute parent PO status ────────────────────────────────────────
  -- Prefer the po_id from the entry if no per-line po_id was encountered
  -- (all lines share the same PO, so v_po_id from last loop iteration suffices).
  IF v_po_id IS NULL THEN
    v_po_id := v_entry_po_id;
  END IF;

  IF v_po_id IS NOT NULL THEN
    SELECT CASE
      -- All lines are received or over_received → fully received
      WHEN NOT EXISTS (
        SELECT 1 FROM po_line_items
        WHERE po_id = v_po_id
          AND received_status NOT IN ('received', 'over_received')
      ) THEN 'received'
      -- Any line has qty_received > 0 → partially received
      WHEN EXISTS (
        SELECT 1 FROM po_line_items
        WHERE po_id = v_po_id
          AND quantity_received > 0
      ) THEN 'partially_received'
      -- Otherwise leave as confirmed (no receiving has happened yet for other lines)
      ELSE 'confirmed'
    END
    INTO v_po_status_new;

    UPDATE purchase_orders
    SET status     = v_po_status_new::TEXT,
        updated_at = now()
    WHERE id = v_po_id
      AND status NOT IN ('cancelled', 'draft');  -- never promote cancelled/draft automatically
  END IF;

  -- ── 7. Confirm the entry ──────────────────────────────────────────────────
  UPDATE receiving_log_entries
  SET
    status = 'confirmed',
    notes  = COALESCE(p_notes, notes),
    po_id  = COALESCE(receiving_log_entries.po_id, v_po_id)
  WHERE id = p_entry_id;

  -- ── Return result ─────────────────────────────────────────────────────────
  RETURN jsonb_build_object(
    'success',          true,
    'entry_id',         p_entry_id,
    'items_processed',  v_items_processed,
    'po_id',            v_po_id,
    'po_status',        v_po_status_new
  );
END;
$$;

-- Grant to authenticated (manager check is inside the function)
GRANT EXECUTE ON FUNCTION confirm_receipt(BIGINT, JSONB, TEXT) TO authenticated;

-- Restrict from public/anon (mirrors the pattern in Phase 1 migration)
REVOKE EXECUTE ON FUNCTION confirm_receipt(BIGINT, JSONB, TEXT) FROM PUBLIC, anon;
