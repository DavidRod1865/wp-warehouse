-- Create receiving_logs table (one per day per user)
CREATE TABLE receiving_logs (
  id serial PRIMARY KEY,
  log_date date NOT NULL,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enforce one log per date per user
CREATE UNIQUE INDEX idx_receiving_logs_date_user ON receiving_logs(log_date, created_by);

-- Create receiving_log_entries table
CREATE TABLE receiving_log_entries (
  id serial PRIMARY KEY,
  receiving_log_id integer REFERENCES receiving_logs(id) ON DELETE CASCADE,
  project_name text,
  vendor text,
  po_number text,
  raw_content text,
  file_url text,
  file_name text,
  parsed_content jsonb,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_receiving_logs_date ON receiving_logs(log_date DESC);
CREATE INDEX idx_receiving_logs_created_by ON receiving_logs(created_by);
CREATE INDEX idx_receiving_log_entries_log ON receiving_log_entries(receiving_log_id);

-- Comments
COMMENT ON TABLE receiving_logs IS 'Daily receiving logs grouping packing lists received on a given date';
COMMENT ON TABLE receiving_log_entries IS 'Individual packing list entries within a daily receiving log';
COMMENT ON COLUMN receiving_log_entries.project_name IS 'Free text project name this packing list belongs to';
COMMENT ON COLUMN receiving_log_entries.vendor IS 'Free text vendor/supplier name';
COMMENT ON COLUMN receiving_log_entries.po_number IS 'Purchase order number';
COMMENT ON COLUMN receiving_log_entries.raw_content IS 'Raw packing list text (pasted by user)';
COMMENT ON COLUMN receiving_log_entries.file_url IS 'Supabase Storage URL for uploaded file';
COMMENT ON COLUMN receiving_log_entries.file_name IS 'Original filename of uploaded file';
COMMENT ON COLUMN receiving_log_entries.parsed_content IS 'AI-parsed content: array of {description, backorder_qty, ship_qty}';

-- RLS
ALTER TABLE receiving_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE receiving_log_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all receiving logs"
  ON receiving_logs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert their own receiving logs"
  ON receiving_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own receiving logs"
  ON receiving_logs FOR UPDATE TO authenticated
  USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own receiving logs"
  ON receiving_logs FOR DELETE TO authenticated
  USING (auth.uid() = created_by);

CREATE POLICY "Authenticated users can view all receiving log entries"
  ON receiving_log_entries FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert entries for their own logs"
  ON receiving_log_entries FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM receiving_logs WHERE id = receiving_log_id AND created_by = auth.uid())
  );

CREATE POLICY "Users can update entries for their own logs"
  ON receiving_log_entries FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM receiving_logs WHERE id = receiving_log_id AND created_by = auth.uid())
  );

CREATE POLICY "Users can delete entries for their own logs"
  ON receiving_log_entries FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM receiving_logs WHERE id = receiving_log_id AND created_by = auth.uid())
  );
