-- ensure_project_locations: transactional find-or-create of a project's three
-- locations (job_site synced to project name/address, rigging yard, warehouse
-- staging). Replaces the old non-transactional client-side sync in
-- useProjectMutations, which skipped syncing when a project update didn't
-- include name/address (leaving legacy projects without locations).
-- Idempotent: safe to call after every project create/update.

CREATE OR REPLACE FUNCTION ensure_project_locations(p_project_id INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_project RECORD;
  v_job_site_id BIGINT;
  v_rigging_id BIGINT;
  v_warehouse_id BIGINT;
BEGIN
  IF NOT is_manager() THEN
    RAISE EXCEPTION 'Insufficient permissions to manage project locations';
  END IF;

  SELECT * INTO v_project FROM projects WHERE id = p_project_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Project % does not exist', p_project_id;
  END IF;

  -- Job site: prefer the row already tagged with this project, else the
  -- legacy job_site_location_id link, else create fresh. Always resync
  -- name/address from the project (project address IS the job site).
  SELECT id INTO v_job_site_id FROM locations
  WHERE project_id = p_project_id AND location_type = 'job_site'
  LIMIT 1;

  IF v_job_site_id IS NULL AND v_project.job_site_location_id IS NOT NULL THEN
    SELECT id INTO v_job_site_id FROM locations
    WHERE id = v_project.job_site_location_id AND location_type = 'job_site';
  END IF;

  IF v_job_site_id IS NULL THEN
    INSERT INTO locations (name, location_type, project_id, address)
    VALUES (v_project.name, 'job_site', p_project_id, v_project.project_address)
    RETURNING id INTO v_job_site_id;
  ELSE
    UPDATE locations
    SET name = v_project.name,
        address = v_project.project_address,
        project_id = p_project_id,
        updated_at = now()
    WHERE id = v_job_site_id;
  END IF;

  UPDATE projects SET job_site_location_id = v_job_site_id
  WHERE id = p_project_id AND job_site_location_id IS DISTINCT FROM v_job_site_id;

  -- Rigging yard
  SELECT id INTO v_rigging_id FROM locations
  WHERE project_id = p_project_id AND location_type = 'rigging_yard'
  LIMIT 1;

  IF v_rigging_id IS NULL THEN
    INSERT INTO locations (name, location_type, project_id)
    VALUES (v_project.name || ' - Rigging Yard', 'rigging_yard', p_project_id)
    RETURNING id INTO v_rigging_id;
  END IF;

  -- Warehouse staging
  SELECT id INTO v_warehouse_id FROM locations
  WHERE project_id = p_project_id AND location_type = 'warehouse_area'
  LIMIT 1;

  IF v_warehouse_id IS NULL THEN
    INSERT INTO locations (name, location_type, project_id)
    VALUES (v_project.name || ' - Warehouse', 'warehouse_area', p_project_id)
    RETURNING id INTO v_warehouse_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'job_site_location_id', v_job_site_id,
    'rigging_yard_location_id', v_rigging_id,
    'warehouse_location_id', v_warehouse_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION ensure_project_locations(INTEGER) TO authenticated;
REVOKE EXECUTE ON FUNCTION ensure_project_locations(INTEGER) FROM PUBLIC, anon;
