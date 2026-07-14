-- Create sortly_webhook_logs table for tracking webhook deliveries
-- This table stores all incoming webhook events from Sortly API

CREATE TABLE sortly_webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL, -- 'Created', 'Edited', 'Moved', 'Deleted'
  item_id integer, -- Sortly item ID from webhook
  payload jsonb NOT NULL,
  processed_at timestamptz DEFAULT now(),
  status text DEFAULT 'processed', -- 'processed', 'failed', 'pending'
  error_message text
);

-- Create indexes for common query patterns
CREATE INDEX idx_webhook_logs_event_type ON sortly_webhook_logs(event_type);
CREATE INDEX idx_webhook_logs_item_id ON sortly_webhook_logs(item_id);
CREATE INDEX idx_webhook_logs_processed_at ON sortly_webhook_logs(processed_at DESC);

-- Enable RLS for security
ALTER TABLE sortly_webhook_logs ENABLE ROW LEVEL SECURITY;

-- Only authenticated users (warehouse managers/admins) can read webhook logs
CREATE POLICY "Authenticated users can read webhook logs"
  ON sortly_webhook_logs
  FOR SELECT
  TO authenticated
  USING (true);

-- Add comment for documentation
COMMENT ON TABLE sortly_webhook_logs IS 'Logs all incoming Sortly webhook events for audit and debugging purposes';
