-- Phase 2: Clients (General Contractors), Vendors, and Projects extension
-- Adds general_contractors and vendors tables, extends projects with new columns

-- ============================================================================
-- 1. GENERAL_CONTRACTORS TABLE
-- ============================================================================

CREATE TABLE general_contractors (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  billing_address JSONB,
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE general_contractors IS 'General contractors (clients) for construction projects';
COMMENT ON COLUMN general_contractors.company_name IS 'Company name (required)';
COMMENT ON COLUMN general_contractors.billing_address IS 'JSONB: street, city, state, zip, notes';

CREATE INDEX idx_general_contractors_is_active ON general_contractors(is_active);
CREATE INDEX idx_general_contractors_company_lower ON general_contractors(LOWER(company_name));

ALTER TABLE general_contractors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can view, insert, update all general_contractors"
  ON general_contractors FOR ALL
  USING (is_manager())
  WITH CHECK (is_manager());

CREATE POLICY "Authenticated users can view active general_contractors"
  ON general_contractors FOR SELECT
  TO authenticated USING (true);

-- ============================================================================
-- 2. VENDORS TABLE
-- ============================================================================

CREATE TABLE vendors (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  address JSONB,
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE vendors IS 'Equipment and material vendors/suppliers';
COMMENT ON COLUMN vendors.name IS 'Vendor name (required)';
COMMENT ON COLUMN vendors.address IS 'JSONB: street, city, state, zip, notes';

CREATE INDEX idx_vendors_is_active ON vendors(is_active);
CREATE UNIQUE INDEX idx_vendors_name_lower ON vendors(LOWER(name));

ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can view, insert, update all vendors"
  ON vendors FOR ALL
  USING (is_manager())
  WITH CHECK (is_manager());

CREATE POLICY "Authenticated users can view active vendors"
  ON vendors FOR SELECT
  TO authenticated USING (true);

-- ============================================================================
-- 3. EXTEND PROJECTS TABLE
-- ============================================================================

ALTER TABLE projects
  ADD COLUMN gc_id BIGINT REFERENCES general_contractors(id) ON DELETE SET NULL,
  ADD COLUMN job_site_location_id BIGINT REFERENCES locations(id) ON DELETE SET NULL,
  ADD COLUMN notes TEXT,
  ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();

COMMENT ON COLUMN projects.gc_id IS 'Reference to general_contractors; NULL allowed for legacy/internal projects';
COMMENT ON COLUMN projects.job_site_location_id IS 'Reference to job site location in the inventory system';
COMMENT ON COLUMN projects.notes IS 'Project notes or description';

CREATE INDEX idx_projects_gc_id ON projects(gc_id);
CREATE INDEX idx_projects_job_site_location_id ON projects(job_site_location_id);

-- ============================================================================
-- 4. BACKFILL GENERAL_CONTRACTORS FROM LEGACY PROJECT DATA
-- ============================================================================

-- Insert unique general_contractors from existing project.general_contractor field
INSERT INTO general_contractors (company_name, is_active, created_at, updated_at)
SELECT DISTINCT
  general_contractor AS company_name,
  TRUE,
  now(),
  now()
FROM projects
WHERE general_contractor IS NOT NULL
  AND general_contractor <> ''
ON CONFLICT DO NOTHING;

-- Update projects to reference the newly created general_contractors
UPDATE projects
SET gc_id = (
  SELECT id FROM general_contractors
  WHERE LOWER(general_contractors.company_name) = LOWER(projects.general_contractor)
  LIMIT 1
)
WHERE general_contractor IS NOT NULL AND general_contractor <> '';

-- ============================================================================
-- 5. AUDIT: DROP OR KEEP general_contractor COLUMN
-- ============================================================================

-- Decision: Keep general_contractor column for now for backward compatibility.
-- It will be deprecated after Phase 5; read-paths should use gc_id + join, not direct column.
-- Note: This column is NOT used in new code; migrations will be explicit about this.

-- ============================================================================
-- 6. VERIFY RLS POLICIES ON PROJECTS
-- ============================================================================

-- The existing projects RLS policies (projects_manager_all + projects_authenticated_select)
-- from 20260710010000_harden_core_rls.sql are already in place and sufficient for new columns.
-- No additional RLS changes needed: managers write via is_manager(), all authenticated read.
