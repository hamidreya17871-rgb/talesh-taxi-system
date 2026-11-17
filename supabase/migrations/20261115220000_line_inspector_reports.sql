/*
  Line inspector designation and driver-to-inspector violation reporting.
  Drivers retain their driver role and receive a separate capability flag.
*/
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_line_inspector boolean NOT NULL DEFAULT false;

GRANT UPDATE (is_line_inspector) ON public.profiles TO authenticated;
DROP POLICY IF EXISTS manager_assign_line_inspector ON public.profiles;
CREATE POLICY manager_assign_line_inspector
  ON public.profiles FOR UPDATE TO authenticated
  USING (public.current_app_role() = 'manager')
  WITH CHECK (public.current_app_role() = 'manager');

CREATE TABLE IF NOT EXISTS public.line_violation_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE RESTRICT,
  reporter_driver_id uuid NOT NULL REFERENCES public.drivers(id) ON DELETE RESTRICT,
  reporter_name text NOT NULL,
  reporter_phone text,
  accused_driver_name text,
  taxi_identifier text NOT NULL CHECK (char_length(trim(taxi_identifier)) BETWEEN 1 AND 80),
  violation_type text NOT NULL CHECK (char_length(trim(violation_type)) BETWEEN 2 AND 100),
  location text NOT NULL CHECK (char_length(trim(location)) BETWEEN 3 AND 240),
  occurred_at timestamptz,
  description text NOT NULL CHECK (char_length(trim(description)) BETWEEN 10 AND 3000),
  status text NOT NULL DEFAULT 'ارسال‌شده'
    CHECK (status IN ('ارسال‌شده', 'دریافت توسط بازرس سازمان', 'در حال بررسی', 'ارجاع به مدیریت', 'مختومه')),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_note text
);

ALTER TABLE public.line_violation_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.line_violation_reports FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.line_violation_reports TO authenticated;
GRANT UPDATE (status, reviewed_by, reviewed_at, review_note)
  ON public.line_violation_reports TO authenticated;

DROP POLICY IF EXISTS line_inspector_submit_report ON public.line_violation_reports;
CREATE POLICY line_inspector_submit_report
  ON public.line_violation_reports FOR INSERT TO authenticated
  WITH CHECK (
    reporter_user_id = auth.uid()
    AND reporter_driver_id = public.current_driver_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.role = 'driver'
        AND p.is_active AND p.approval_status = 'approved'
        AND p.is_line_inspector
    )
    AND status = 'ارسال‌شده'
    AND reviewed_by IS NULL AND reviewed_at IS NULL
  );

DROP POLICY IF EXISTS line_inspector_read_own_reports ON public.line_violation_reports;
CREATE POLICY line_inspector_read_own_reports
  ON public.line_violation_reports FOR SELECT TO authenticated
  USING (reporter_user_id = auth.uid());

DROP POLICY IF EXISTS organization_inspector_read_reports ON public.line_violation_reports;
CREATE POLICY organization_inspector_read_reports
  ON public.line_violation_reports FOR SELECT TO authenticated
  USING (public.current_app_role() IN ('manager', 'expert'));

DROP POLICY IF EXISTS organization_inspector_update_reports ON public.line_violation_reports;
CREATE POLICY organization_inspector_update_reports
  ON public.line_violation_reports FOR UPDATE TO authenticated
  USING (public.current_app_role() IN ('manager', 'expert'))
  WITH CHECK (public.current_app_role() IN ('manager', 'expert'));

CREATE INDEX IF NOT EXISTS line_violation_reports_created_at_idx
  ON public.line_violation_reports (created_at DESC);
CREATE INDEX IF NOT EXISTS line_violation_reports_reporter_idx
  ON public.line_violation_reports (reporter_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS line_violation_reports_status_idx
  ON public.line_violation_reports (status);
