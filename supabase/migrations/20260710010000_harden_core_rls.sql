-- Security hardening: remove blanket USING(true) RLS policies that defeated
-- the existing granular policies, and protect credential columns on users.
--
-- Before this migration, ANY authenticated user could read/write every row of
-- users (including drivers' plaintext internal_auth_token and role — privilege
-- escalation), deliveries, delivery_items, projects, and activity_log.
--
-- Edge Functions use the service role and bypass RLS, so driver login/PIN and
-- driver-management flows are unaffected.

-- ============================================================================
-- 1. USERS — drop blanket policy; keep/add granular ones + column-level grants
-- ============================================================================

DROP POLICY IF EXISTS "Allow authenticated users full access to users" ON users;

-- Existing granular policies kept: users_select_own, users_select_managers,
-- users_insert_managers, users_update_driver_folder

-- Self-update (column grants below limit WHICH columns can change)
DROP POLICY IF EXISTS users_update_own ON users;
CREATE POLICY users_update_own
  ON users FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Column-level privileges: hide credential/lockout columns from ALL client
-- roles (pin_code, internal_auth_token, pin_failed_attempts, pin_locked_until)
-- and limit client-side updates to profile fields. Managers manage drivers
-- through Edge Functions (service role), not direct table writes.
REVOKE SELECT, INSERT, UPDATE, DELETE ON users FROM authenticated, anon;
GRANT SELECT (id, email, role, active, created_at, driver_sortly_folder_id,
              username, name, notification_preferences, force_pin_change,
              last_password_reset_at, last_password_reset_by)
  ON users TO authenticated;
GRANT UPDATE (name, notification_preferences) ON users TO authenticated;

-- ============================================================================
-- 2. DELIVERIES — managers full access; drivers see/update their own
-- ============================================================================

DROP POLICY IF EXISTS "Allow authenticated users to insert deliveries" ON deliveries;
DROP POLICY IF EXISTS "Allow authenticated users to update deliveries" ON deliveries;
DROP POLICY IF EXISTS "Allow authenticated users to view deliveries" ON deliveries;

DROP POLICY IF EXISTS deliveries_manager_all ON deliveries;
CREATE POLICY deliveries_manager_all
  ON deliveries FOR ALL
  USING (is_manager())
  WITH CHECK (is_manager());

DROP POLICY IF EXISTS deliveries_driver_select_own ON deliveries;
CREATE POLICY deliveries_driver_select_own
  ON deliveries FOR SELECT
  USING (driver_id = auth.uid());

DROP POLICY IF EXISTS deliveries_driver_update_own ON deliveries;
CREATE POLICY deliveries_driver_update_own
  ON deliveries FOR UPDATE
  USING (driver_id = auth.uid())
  WITH CHECK (driver_id = auth.uid());

-- ============================================================================
-- 3. DELIVERY_ITEMS — managers full access; drivers via their own deliveries
-- ============================================================================

DROP POLICY IF EXISTS "Allow authenticated users full access to delivery_items" ON delivery_items;

DROP POLICY IF EXISTS delivery_items_manager_all ON delivery_items;
CREATE POLICY delivery_items_manager_all
  ON delivery_items FOR ALL
  USING (is_manager())
  WITH CHECK (is_manager());

DROP POLICY IF EXISTS delivery_items_driver_select_own ON delivery_items;
CREATE POLICY delivery_items_driver_select_own
  ON delivery_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM deliveries d
    WHERE d.id = delivery_items.delivery_id AND d.driver_id = auth.uid()
  ));

DROP POLICY IF EXISTS delivery_items_driver_update_own ON delivery_items;
CREATE POLICY delivery_items_driver_update_own
  ON delivery_items FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM deliveries d
    WHERE d.id = delivery_items.delivery_id AND d.driver_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM deliveries d
    WHERE d.id = delivery_items.delivery_id AND d.driver_id = auth.uid()
  ));

-- ============================================================================
-- 4. PROJECTS — managers write; all authenticated read
-- ============================================================================

DROP POLICY IF EXISTS "Allow authenticated users full access to projects" ON projects;

DROP POLICY IF EXISTS projects_manager_all ON projects;
CREATE POLICY projects_manager_all
  ON projects FOR ALL
  USING (is_manager())
  WITH CHECK (is_manager());

DROP POLICY IF EXISTS projects_authenticated_select ON projects;
CREATE POLICY projects_authenticated_select
  ON projects FOR SELECT
  TO authenticated USING (true);

-- ============================================================================
-- 5. ACTIVITY_LOG — managers only from the client (Edge Functions bypass RLS)
-- ============================================================================

DROP POLICY IF EXISTS "Allow authenticated users full access to activity_log" ON activity_log;

DROP POLICY IF EXISTS activity_log_manager_all ON activity_log;
CREATE POLICY activity_log_manager_all
  ON activity_log FOR ALL
  USING (is_manager())
  WITH CHECK (is_manager());

-- ============================================================================
-- 6. Helper functions — not callable by anon / not part of the public API
-- ============================================================================

REVOKE EXECUTE ON FUNCTION is_manager() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION rls_auto_enable() FROM PUBLIC, anon, authenticated;
