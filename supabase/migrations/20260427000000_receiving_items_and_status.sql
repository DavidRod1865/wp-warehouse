-- Receiving workflow redesign: add line-item tracking and status columns
-- Supports multi-step receiving with Sortly inventory integration

-- 1. Add status and destination columns to receiving_log_entries
ALTER TABLE receiving_log_entries
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS destination_type text,
  ADD COLUMN IF NOT EXISTS destination_folder_id integer,
  ADD COLUMN IF NOT EXISTS date_received date;

COMMENT ON COLUMN receiving_log_entries.status IS 'Receipt status: draft | confirmed';
COMMENT ON COLUMN receiving_log_entries.destination_type IS 'Where items go: project | warehouse';
COMMENT ON COLUMN receiving_log_entries.destination_folder_id IS 'Sortly folder ID where items were placed';
COMMENT ON COLUMN receiving_log_entries.date_received IS 'User-specified date items were received';

CREATE INDEX IF NOT EXISTS idx_rle_status ON receiving_log_entries(status);

-- 2. Create receiving_items table (line items per receipt)
CREATE TABLE receiving_items (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  receiving_entry_id integer NOT NULL REFERENCES receiving_log_entries(id) ON DELETE CASCADE,
  sortly_item_id integer,
  item_name text NOT NULL,
  part_number text,
  quantity_received integer NOT NULL DEFAULT 1,
  action text NOT NULL DEFAULT 'pending',
  sortly_quantity_before integer,
  sortly_quantity_after integer,
  destination_folder_id integer,
  notes text,
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE receiving_items IS 'Individual line items within a receiving log entry';
COMMENT ON COLUMN receiving_items.sortly_item_id IS 'Linked Sortly item ID (NULL if unmatched/pending)';
COMMENT ON COLUMN receiving_items.action IS 'Item action: pending | update | create | skip';
COMMENT ON COLUMN receiving_items.sortly_quantity_before IS 'Sortly quantity snapshot before receiving update';
COMMENT ON COLUMN receiving_items.sortly_quantity_after IS 'Sortly quantity snapshot after receiving update';
COMMENT ON COLUMN receiving_items.destination_folder_id IS 'Sortly folder where item was placed or created';

CREATE INDEX idx_receiving_items_entry ON receiving_items(receiving_entry_id);
CREATE INDEX idx_receiving_items_sortly ON receiving_items(sortly_item_id);

-- 3. RLS for receiving_items
ALTER TABLE receiving_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all receiving items"
  ON receiving_items FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert items for their own receipt entries"
  ON receiving_items FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM receiving_log_entries rle
      JOIN receiving_logs rl ON rl.id = rle.receiving_log_id
      WHERE rle.id = receiving_entry_id AND rl.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can update items for their own receipt entries"
  ON receiving_items FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM receiving_log_entries rle
      JOIN receiving_logs rl ON rl.id = rle.receiving_log_id
      WHERE rle.id = receiving_entry_id AND rl.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can delete items for their own receipt entries"
  ON receiving_items FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM receiving_log_entries rle
      JOIN receiving_logs rl ON rl.id = rle.receiving_log_id
      WHERE rle.id = receiving_entry_id AND rl.created_by = auth.uid()
    )
  );
