-- Drop unused tables and their FK references
-- These tables have zero code references in the current application

-- 1. Drop FK constraints that reference tables being dropped
ALTER TABLE deliveries DROP CONSTRAINT IF EXISTS deliveries_batch_id_fkey;
ALTER TABLE receiving_log_entries DROP CONSTRAINT IF EXISTS receiving_log_entries_vendor_id_fkey;

-- 2. Drop FK columns that referenced dropped tables
ALTER TABLE deliveries DROP COLUMN IF EXISTS batch_id;
ALTER TABLE deliveries DROP COLUMN IF EXISTS sequence_in_batch;
ALTER TABLE receiving_log_entries DROP COLUMN IF EXISTS vendor_id;

-- 3. Drop unused tables (order matters for FK dependencies)
DROP TABLE IF EXISTS adjustment_items CASCADE;
DROP TABLE IF EXISTS inventory_adjustments CASCADE;
DROP TABLE IF EXISTS delivery_item_locks CASCADE;
DROP TABLE IF EXISTS delivery_photos CASCADE;
DROP TABLE IF EXISTS delivery_batches CASCADE;
DROP TABLE IF EXISTS sortly_audit_log CASCADE;
DROP TABLE IF EXISTS sortly_operations CASCADE;
DROP TABLE IF EXISTS vendor_addresses CASCADE;
