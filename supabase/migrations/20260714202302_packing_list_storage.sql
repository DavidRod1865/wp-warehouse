-- ============================================================================
-- Packing-list archival for receiving
--
-- Receiving parses a packing-list PDF (parse-packing-list edge fn) but discards
-- the file. This migration keeps a copy on file:
--   1. A private `packing-lists` storage bucket (+ RLS).
--   2. A `packing_list_storage_path` column on receiving_log_entries.
--
-- The existing `file_name` column (from 20260402000000_create_receiving_logs.sql)
-- is reused for the original filename. Legacy `file_url` is left untouched.
-- ============================================================================

-- 1. Column: storage path of the archived packing list (nullable — not every
--    receipt has one; escape-hatch receipts may be file-less).
ALTER TABLE receiving_log_entries
  ADD COLUMN IF NOT EXISTS packing_list_storage_path TEXT;

COMMENT ON COLUMN receiving_log_entries.packing_list_storage_path
  IS 'Path within the private packing-lists bucket; view via createSignedUrl.';

-- 2. Storage bucket: packing-lists (private, PDF-only)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'packing-lists',
  'packing-lists',
  false,
  10485760, -- 10 MB
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Any authenticated user (receiving clerks, not only managers) can upload.
DROP POLICY IF EXISTS "Authenticated users can upload packing lists" ON storage.objects;
CREATE POLICY "Authenticated users can upload packing lists"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'packing-lists');

-- Any authenticated user can view/download packing lists.
DROP POLICY IF EXISTS "Authenticated users can view packing lists" ON storage.objects;
CREATE POLICY "Authenticated users can view packing lists"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'packing-lists');

-- Only managers can delete packing lists.
DROP POLICY IF EXISTS "Managers can delete packing lists" ON storage.objects;
CREATE POLICY "Managers can delete packing lists"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'packing-lists' AND is_manager());
