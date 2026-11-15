-- Reduce public report abuse and prevent anonymous callers from backdating submissions.
REVOKE INSERT ON public.citizen_violation_reports FROM anon;
GRANT INSERT (
  full_name, phone, violation_type, taxi_identifier, location, description
) ON public.citizen_violation_reports TO anon;

CREATE OR REPLACE FUNCTION public.can_submit_citizen_violation_report(p_phone text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    count(*) FILTER (WHERE r.created_at >= now() - interval '1 hour') < 3
    AND count(*) FILTER (WHERE r.created_at >= now() - interval '24 hours') < 10
  FROM public.citizen_violation_reports r
  WHERE r.phone = p_phone
$$;

REVOKE ALL ON FUNCTION public.can_submit_citizen_violation_report(text) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.can_submit_citizen_violation_report(text) TO anon;

DROP POLICY IF EXISTS citizen_submit_violation_report ON public.citizen_violation_reports;
CREATE POLICY citizen_submit_violation_report
  ON public.citizen_violation_reports
  FOR INSERT TO anon
  WITH CHECK (
    status = 'دریافت‌شده'
    AND reviewed_at IS NULL
    AND reviewed_by IS NULL
    AND staff_note IS NULL
    AND public.can_submit_citizen_violation_report(phone)
  );
