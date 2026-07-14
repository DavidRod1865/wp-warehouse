-- Create inventory_adjustments table
CREATE TABLE inventory_adjustments (
  id serial PRIMARY KEY,
  adjustment_number text UNIQUE NOT NULL, -- ADJ-YYYYMMDD-XXX
  adjustment_type text NOT NULL, -- 'return', 'damage', 'transfer', 'manual'
  source_folder_id integer,
  destination_folder_id integer,
  adjusted_by uuid REFERENCES auth.users(id),
  reason text NOT NULL,
  notes text,
  status text DEFAULT 'completed', -- 'pending', 'completed', 'cancelled'
  created_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

-- Create adjustment_items table
CREATE TABLE adjustment_items (
  id serial PRIMARY KEY,
  adjustment_id integer REFERENCES inventory_adjustments(id) ON DELETE CASCADE,
  sortly_item_id integer NOT NULL,
  item_name text NOT NULL,
  quantity integer NOT NULL,
  notes text
);

-- Create indexes for efficient queries
CREATE INDEX idx_adjustments_type ON inventory_adjustments(adjustment_type);
CREATE INDEX idx_adjustments_date ON inventory_adjustments(created_at DESC);
CREATE INDEX idx_adjustments_user ON inventory_adjustments(adjusted_by);
CREATE INDEX idx_adjustment_items_adjustment ON adjustment_items(adjustment_id);

-- Add comments for documentation
COMMENT ON TABLE inventory_adjustments IS 'Tracks inventory adjustments (returns, damages, transfers, manual adjustments)';
COMMENT ON TABLE adjustment_items IS 'Individual items within an inventory adjustment';
COMMENT ON COLUMN inventory_adjustments.adjustment_number IS 'Unique identifier in format ADJ-YYYYMMDD-XXX';
COMMENT ON COLUMN inventory_adjustments.adjustment_type IS 'Type of adjustment: return, damage, transfer, manual';
COMMENT ON COLUMN inventory_adjustments.source_folder_id IS 'Sortly folder ID items are coming from (nullable for new items)';
COMMENT ON COLUMN inventory_adjustments.destination_folder_id IS 'Sortly folder ID items are going to (nullable for removals)';
COMMENT ON COLUMN inventory_adjustments.status IS 'Adjustment status: pending, completed, cancelled';
