/*
# Staff accounts, roles and leave requests

1. New Tables
- `profiles`: one row per staff sign-in account. Stores the email, display name, role (manager, expert or driver), the linked driver record for driver accounts, and an active flag.
- `leave_requests`: leave requests for drivers. Stores leave type, start and end dates, a calculated number of days, reason, review status, reviewer note and a sequential letter number.

2. Modified Tables
- Existing fleet tables (drivers, vehicles, licenses, documents, reminders, violations) keep all their rows. Their open access policies are replaced with role-based ones.

3. Security
- Helper functions read the signed-in user's own role and linked driver record.
- Anonymous access is removed from every table. Every screen now requires sign-in.
- Managers and experts can read and change fleet records.
- Drivers can read only their own driver record and their own leave requests.
- Drivers can create leave requests, which always start as pending.
- Only managers and experts can approve or reject a pending request. A decided request cannot be changed afterwards.
- Only managers can delete leave requests.
- Staff profiles are readable by their owner and by managers. Clients cannot change roles directly; account changes go through a server function.

4. Notes
- Deleting a driver record also deletes that driver's leave requests and unlinks any account attached to it.
- Statements are idempotent and safe to re-run.
*/

CREATE TABLE IF NOT EXISTS profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('manager', 'expert', 'driver')),
  driver_id uuid REFERENCES drivers(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS profiles_driver_id_key ON profiles (driver_id) WHERE driver_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  letter_no bigint GENERATED ALWAYS AS IDENTITY,
  driver_id uuid NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  leave_type text NOT NULL CHECK (leave_type IN ('استحقاقی', 'استعلاجی', 'بدون حقوق', 'اضطراری', 'سایر')),
  start_date date NOT NULL,
  end_date date NOT NULL,
  days integer GENERATED ALWAYS AS (end_date - start_date + 1) STORED,
  reason text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewer_note text,
  requested_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date),
  CHECK (status = 'pending' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS leave_requests_driver_id_idx ON leave_requests (driver_id);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.role FROM public.profiles AS p
  WHERE p.user_id = auth.uid() AND p.is_active
$$;

CREATE OR REPLACE FUNCTION public.current_driver_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.driver_id FROM public.profiles AS p
  WHERE p.user_id = auth.uid() AND p.is_active AND p.role = 'driver'
$$;

REVOKE EXECUTE ON FUNCTION public.current_app_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_app_role() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.current_driver_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_driver_id() TO authenticated;

DO $$
DECLARE
  t text;
  p text;
BEGIN
  FOREACH t IN ARRAY ARRAY['drivers', 'vehicles', 'licenses', 'documents', 'reminders', 'violations'] LOOP
    FOREACH p IN ARRAY ARRAY['select', 'insert', 'update', 'delete', 'select_anon_legacy'] LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'anon_' || replace(p, '_anon_legacy', '') || '_' || t, t);
    END LOOP;
  END LOOP;
END $$;

REVOKE ALL ON drivers, vehicles, licenses, documents, reminders, violations FROM anon;
REVOKE ALL ON drivers, vehicles, licenses, documents, reminders, violations FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON drivers, vehicles, licenses, documents, reminders, violations TO authenticated;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['drivers', 'vehicles', 'licenses', 'documents', 'reminders', 'violations'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'staff_select_' || t, t);
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (current_app_role() IN (''manager'', ''expert''))', 'staff_select_' || t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'staff_insert_' || t, t);
    EXECUTE format('CREATE POLICY %I ON %I FOR INSERT TO authenticated WITH CHECK (current_app_role() IN (''manager'', ''expert''))', 'staff_insert_' || t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'staff_update_' || t, t);
    EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE TO authenticated USING (current_app_role() IN (''manager'', ''expert'')) WITH CHECK (current_app_role() IN (''manager'', ''expert''))', 'staff_update_' || t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'staff_delete_' || t, t);
    EXECUTE format('CREATE POLICY %I ON %I FOR DELETE TO authenticated USING (current_app_role() IN (''manager'', ''expert''))', 'staff_delete_' || t, t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "driver_select_own_record" ON drivers;
CREATE POLICY "driver_select_own_record" ON drivers FOR SELECT TO authenticated
  USING (id = current_driver_id());

REVOKE ALL ON profiles, leave_requests FROM anon, authenticated;
GRANT SELECT ON profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON profiles TO service_role;
GRANT SELECT ON drivers TO service_role;
GRANT SELECT ON leave_requests TO authenticated;
GRANT INSERT (driver_id, leave_type, start_date, end_date, reason) ON leave_requests TO authenticated;
GRANT UPDATE (status, reviewer_note, reviewed_by, reviewed_at) ON leave_requests TO authenticated;
GRANT DELETE ON leave_requests TO authenticated;

DROP POLICY IF EXISTS "profiles_select_own_or_manager" ON profiles;
CREATE POLICY "profiles_select_own_or_manager" ON profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR current_app_role() = 'manager');

DROP POLICY IF EXISTS "staff_select_leave_requests" ON leave_requests;
CREATE POLICY "staff_select_leave_requests" ON leave_requests FOR SELECT TO authenticated
  USING (current_app_role() IN ('manager', 'expert'));

DROP POLICY IF EXISTS "driver_select_own_leave_requests" ON leave_requests;
CREATE POLICY "driver_select_own_leave_requests" ON leave_requests FOR SELECT TO authenticated
  USING (driver_id = current_driver_id());

DROP POLICY IF EXISTS "driver_request_leave" ON leave_requests;
CREATE POLICY "driver_request_leave" ON leave_requests FOR INSERT TO authenticated
  WITH CHECK (
    driver_id = current_driver_id()
    AND requested_by = auth.uid()
    AND status = 'pending'
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
  );

DROP POLICY IF EXISTS "staff_review_pending_leave" ON leave_requests;
CREATE POLICY "staff_review_pending_leave" ON leave_requests FOR UPDATE TO authenticated
  USING (current_app_role() IN ('manager', 'expert') AND status = 'pending')
  WITH CHECK (
    current_app_role() IN ('manager', 'expert')
    AND status IN ('approved', 'rejected')
    AND reviewed_by = auth.uid()
  );

DROP POLICY IF EXISTS "manager_delete_leave_requests" ON leave_requests;
CREATE POLICY "manager_delete_leave_requests" ON leave_requests FOR DELETE TO authenticated
  USING (current_app_role() = 'manager');
