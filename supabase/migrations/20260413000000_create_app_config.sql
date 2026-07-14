-- Create app_config table for configurable settings
-- Replaces hardcoded Sortly folder IDs and other constants

CREATE TABLE IF NOT EXISTS app_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: allow all authenticated users to read config
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read"
  ON app_config FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can modify config
CREATE POLICY "Allow admin write"
  ON app_config FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- Seed with Sortly folder IDs
-- IMPORTANT: Before running, resolve SIDs to numeric IDs via Sortly API:
--   Main Warehouse  SID: SKOB2R0048
--   Delivery Trucks SID: SKOB2R0062
-- The existing TRUCKS_FOLDER_ID in the codebase was 102892637.
-- Update the values below with the correct numeric IDs from Sortly.
INSERT INTO app_config (key, value, description) VALUES
  ('main_warehouse_folder_id', '97514702', 'Sortly numeric ID for main warehouse (SID: SKOB2R0048)'),
  ('delivery_trucks_folder_id', '102892637', 'Sortly numeric ID for Delivery Trucks folder (SID: SKOB2R0062)')
ON CONFLICT (key) DO NOTHING;
