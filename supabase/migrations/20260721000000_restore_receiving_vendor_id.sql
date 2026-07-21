-- Restore receiving_log_entries.vendor_id, now pointing at the vendors directory.
--
-- History: 20260409 added vendor_id referencing the old vendor_addresses table;
-- 20260428 dropped it along with vendor_addresses. The receiving UI (vendor
-- selector + useConfirmReceipt) still writes vendor_id, so every receipt
-- confirmation failed with "Could not find the 'vendor_id' column". The column
-- returns as a nullable FK to the current vendors table.

ALTER TABLE receiving_log_entries
  ADD COLUMN IF NOT EXISTS vendor_id bigint REFERENCES vendors(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_receiving_log_entries_vendor_id
  ON receiving_log_entries(vendor_id);

COMMENT ON COLUMN receiving_log_entries.vendor_id IS
  'Optional link to the vendors directory; vendor (text) remains for free-text/legacy entries.';
