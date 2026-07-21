-- Project-scoped locations: rigging_yard type + locations.project_id + backfill.
--
-- Every project tracks inventory across three of its own locations
-- (warehouse staging, rigging yard, job site). locations.project_id is the
-- new canonical link; projects.job_site_location_id is kept for back-compat
-- (the po_project_reconciliation view reads it) and stays in sync via the
-- ensure_project_locations RPC (see 20260721030000).

-- 1. Allow the new location type
ALTER TABLE locations DROP CONSTRAINT location_type_valid;
ALTER TABLE locations ADD CONSTRAINT location_type_valid
  CHECK (location_type IN ('warehouse_area', 'truck', 'job_site', 'rigging_yard'));

COMMENT ON COLUMN locations.location_type IS
  'Type of location: warehouse_area, truck, job_site, or rigging_yard';

-- 2. Link locations to projects (nullable: shared warehouse areas and trucks
--    keep project_id NULL; per-project locations set it)
ALTER TABLE locations ADD COLUMN IF NOT EXISTS project_id INTEGER
  REFERENCES projects(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_locations_project_id ON locations(project_id);

COMMENT ON COLUMN locations.project_id IS
  'Owning project for per-project locations (job_site, rigging_yard, project warehouse staging); NULL for shared locations.';

-- 3. Backfill (idempotent)

-- 3a. Tag existing job-site locations with their owning project
UPDATE locations l
SET project_id = p.id
FROM projects p
WHERE p.job_site_location_id = l.id
  AND l.project_id IS NULL;

-- 3b. Create missing job_site locations for legacy projects and link them
WITH created AS (
  INSERT INTO locations (name, location_type, project_id, address)
  SELECT p.name, 'job_site', p.id, p.project_address
  FROM projects p
  WHERE p.job_site_location_id IS NULL
  RETURNING id, project_id
)
UPDATE projects p
SET job_site_location_id = c.id
FROM created c
WHERE p.id = c.project_id;

-- 3c. Rigging yard per project
INSERT INTO locations (name, location_type, project_id)
SELECT p.name || ' - Rigging Yard', 'rigging_yard', p.id
FROM projects p
WHERE NOT EXISTS (
  SELECT 1 FROM locations l
  WHERE l.project_id = p.id AND l.location_type = 'rigging_yard'
);

-- 3d. Warehouse staging area per project
INSERT INTO locations (name, location_type, project_id)
SELECT p.name || ' - Warehouse', 'warehouse_area', p.id
FROM projects p
WHERE NOT EXISTS (
  SELECT 1 FROM locations l
  WHERE l.project_id = p.id AND l.location_type = 'warehouse_area'
);
