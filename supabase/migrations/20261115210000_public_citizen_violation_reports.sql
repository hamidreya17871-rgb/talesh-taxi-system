/*
  Public citizen violation reports.
  Anonymous visitors may submit a report but cannot read, update, or delete any report.
  Staff access is limited to active managers and experts through RLS.
*/
CREATE TABLE IF NOT EXISTS public.citizen_violation_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL CHECK (char_length(trim(full_name)) BETWEEN 2 AND 120),
  phone text NOT NULL CHECK (phone ~ '^09[0-9]{9}$'),
  violation_type text NOT NULL CHECK (char_length(trim(violation_type)) BETWEEN 2 AND 80),
  taxi_identifier text CHECK (taxi_identifier IS NULL OR char_length(trim(taxi_identifier)) <= 80),
  location text NOT NULL CHECK (char_length(trim(location)) BETWEEN 3 AND 240),
  description text NOT NULL CHECK (char_length(trim(description)) BETWEEN 10 AND 3000),
  status text NOT NULL DEFAULT 'دریافت‌شده'
    CHECK (status IN ('دریافت‌شده', 'در حال بررسی', 'ارجاع به بازرسی', 'رسیدگی شد', 'مختومه')),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  staff_note text
);

ALTER TABLE public.citizen_violation_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.citizen_violation_reports FROM PUBLIC, anon, authenticated;
GRANT INSERT ON public.citizen_violation_reports TO anon;
GRANT SELECT, UPDATE ON public.citizen_violation_reports TO authenticated;

DROP POLICY IF EXISTS citizen_submit_violation_report ON public.citizen_violation_reports;
CREATE POLICY citizen_submit_violation_report
  ON public.citizen_violation_reports
  FOR INSERT TO anon
  WITH CHECK (
    status = 'دریافت‌شده'
    AND reviewed_at IS NULL
    AND reviewed_by IS NULL
    AND staff_note IS NULL
  );

DROP POLICY IF EXISTS staff_read_citizen_violation_reports ON public.citizen_violation_reports;
CREATE POLICY staff_read_citizen_violation_reports
  ON public.citizen_violation_reports
  FOR SELECT TO authenticated
  USING (public.current_app_role() IN ('manager', 'expert'));

DROP POLICY IF EXISTS staff_update_citizen_violation_reports ON public.citizen_violation_reports;
CREATE POLICY staff_update_citizen_violation_reports
  ON public.citizen_violation_reports
  FOR UPDATE TO authenticated
  USING (public.current_app_role() IN ('manager', 'expert'))
  WITH CHECK (public.current_app_role() IN ('manager', 'expert'));

CREATE INDEX IF NOT EXISTS citizen_violation_reports_created_at_idx
  ON public.citizen_violation_reports (created_at DESC);
CREATE INDEX IF NOT EXISTS citizen_violation_reports_status_idx
  ON public.citizen_violation_reports (status);
