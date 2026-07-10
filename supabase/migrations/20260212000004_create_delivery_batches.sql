-- Create delivery batches table for batch delivery tracking and route planning
-- This enables grouping deliveries into batches assigned to drivers with scheduling

-- Create delivery_batches table
CREATE TABLE IF NOT EXISTS delivery_batches (
  id serial PRIMARY KEY,
  batch_number text UNIQUE NOT NULL, -- Format: BATCH-YYYYMMDD-XXX
  driver_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  scheduled_date date NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  notes text
);

-- Add batch-related columns to deliveries table
ALTER TABLE deliveries
ADD COLUMN IF NOT EXISTS batch_id integer REFERENCES delivery_batches(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS sequence_in_batch integer;

-- Enable RLS on delivery_batches
ALTER TABLE delivery_batches ENABLE ROW LEVEL SECURITY;

-- Managers and admins can view all batches
CREATE POLICY "Managers can view all batches"
  ON delivery_batches FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('warehouse_manager', 'admin', 'apm')
    )
  );

-- Drivers can view their own batches
CREATE POLICY "Drivers can view own batches"
  ON delivery_batches FOR SELECT
  USING (auth.uid() = driver_id);

-- Managers can insert batches
CREATE POLICY "Managers can insert batches"
  ON delivery_batches FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('warehouse_manager', 'admin', 'apm')
    )
  );

-- Managers can update batches
CREATE POLICY "Managers can update batches"
  ON delivery_batches FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('warehouse_manager', 'admin', 'apm')
    )
  );

-- Drivers can update their own batch status
CREATE POLICY "Drivers can update own batch status"
  ON delivery_batches FOR UPDATE
  USING (auth.uid() = driver_id)
  WITH CHECK (auth.uid() = driver_id);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_batches_driver ON delivery_batches(driver_id);
CREATE INDEX IF NOT EXISTS idx_batches_date ON delivery_batches(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_batches_status ON delivery_batches(status);
CREATE INDEX IF NOT EXISTS idx_batches_created_at ON delivery_batches(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deliveries_batch ON deliveries(batch_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_batch_sequence ON deliveries(batch_id, sequence_in_batch);

-- Add comments for documentation
COMMENT ON TABLE delivery_batches IS 'Groups deliveries into batches for route planning and driver assignment';
COMMENT ON COLUMN delivery_batches.batch_number IS 'Unique batch identifier in format BATCH-YYYYMMDD-XXX';
COMMENT ON COLUMN delivery_batches.driver_id IS 'Driver assigned to this batch (nullable for unassigned batches)';
COMMENT ON COLUMN delivery_batches.scheduled_date IS 'Date when the batch is scheduled for delivery';
COMMENT ON COLUMN delivery_batches.status IS 'Batch status: pending, in_progress, completed, or cancelled';
COMMENT ON COLUMN delivery_batches.created_by IS 'User who created the batch';
COMMENT ON COLUMN deliveries.batch_id IS 'References the batch this delivery belongs to (nullable for standalone deliveries)';
COMMENT ON COLUMN deliveries.sequence_in_batch IS 'Order of delivery within the batch for route optimization';

-- Create function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_delivery_batches_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
CREATE TRIGGER update_delivery_batches_updated_at
  BEFORE UPDATE ON delivery_batches
  FOR EACH ROW
  EXECUTE FUNCTION update_delivery_batches_updated_at();
