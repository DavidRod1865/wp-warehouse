-- Fix deliveries.driver_id type to be UUID instead of integer
-- This migration ensures driver_id matches the users table id type (UUID)

DO $$
DECLARE
  driver_id_type text;
BEGIN
  -- Get current data type of driver_id
  SELECT data_type INTO driver_id_type
  FROM information_schema.columns
  WHERE table_name = 'deliveries'
  AND column_name = 'driver_id';

  -- Only proceed if driver_id exists and is not already UUID
  IF driver_id_type IS NOT NULL AND driver_id_type != 'uuid' THEN
    -- Add temporary UUID column
    ALTER TABLE deliveries ADD COLUMN driver_id_uuid uuid;

    -- Drop the old integer column (CASCADE removes any dependent constraints/indexes)
    ALTER TABLE deliveries DROP COLUMN driver_id CASCADE;

    -- Rename the new column
    ALTER TABLE deliveries RENAME COLUMN driver_id_uuid TO driver_id;

    -- Add foreign key constraint
    ALTER TABLE deliveries
      ADD CONSTRAINT deliveries_driver_id_fkey
      FOREIGN KEY (driver_id)
      REFERENCES auth.users(id)
      ON DELETE SET NULL;

    -- Add index for performance
    CREATE INDEX idx_deliveries_driver ON deliveries(driver_id);

    -- Add comment
    COMMENT ON COLUMN deliveries.driver_id IS 'Driver assigned to this delivery (references auth.users)';

    RAISE NOTICE 'Converted deliveries.driver_id from % to uuid', driver_id_type;
  ELSIF driver_id_type IS NULL THEN
    -- Column doesn't exist, create it as UUID
    ALTER TABLE deliveries ADD COLUMN driver_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
    CREATE INDEX idx_deliveries_driver ON deliveries(driver_id);
    COMMENT ON COLUMN deliveries.driver_id IS 'Driver assigned to this delivery (references auth.users)';
    RAISE NOTICE 'Created deliveries.driver_id as uuid';
  ELSE
    RAISE NOTICE 'deliveries.driver_id is already uuid, no changes needed';
  END IF;
END $$;
