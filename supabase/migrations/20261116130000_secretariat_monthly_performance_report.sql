-- Manager-only monthly performance reporting for Secretariat referrals.
-- Uses completion timestamps; legacy completed referrals without completed_at
-- are intentionally excluded from time-based metrics rather than guessed.

DROP POLICY IF EXISTS profiles_manager_secretariat_report_read ON public.profiles;
CREATE POLICY profiles_manager_secretariat_report_read
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING ((SELECT public.current_app_role()) = 'manager');

CREATE OR REPLACE FUNCTION public.get_monthly_secretariat_performance(
  p_month_start timestamptz,
  p_month_end timestamptz
)
RETURNS TABLE (
  staff_user_id uuid,
  staff_name text,
  assigned_count bigint,
  completed_count bigint,
  pending_at_month_end bigint,
  overdue_at_month_end bigint,
  average_response_hours numeric,
  on_time_completed bigint,
  on_time_eligible bigint
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_as_of timestamptz;
BEGIN
  IF auth.uid() IS NULL OR public.current_app_role() IS DISTINCT FROM 'manager' THEN
    RAISE EXCEPTION 'گزارش عملکرد کارشناسان فقط برای مدیر سازمان مجاز است.'
      USING ERRCODE = '42501';
  END IF;

  IF p_month_start IS NULL OR p_month_end IS NULL OR p_month_start >= p_month_end THEN
    RAISE EXCEPTION 'بازه ماه گزارش معتبر نیست.' USING ERRCODE = '22023';
  END IF;

  -- Past months are measured at their exclusive month-end boundary.
  -- The current month is measured through the current instant, not a future month-end.
  v_as_of := LEAST(p_month_end, now());

  RETURN QUERY
  SELECT
    p.user_id AS staff_user_id,
    p.full_name::text AS staff_name,
    COUNT(r.id) FILTER (
      WHERE r.created_at >= p_month_start AND r.created_at < p_month_end
    ) AS assigned_count,
    COUNT(r.id) FILTER (
      WHERE r.completed_at >= p_month_start AND r.completed_at < p_month_end
    ) AS completed_count,
    COUNT(r.id) FILTER (
      WHERE v_as_of > p_month_start
        AND r.created_at < v_as_of
        AND (
          r.status = 'pending'
          OR (r.status = 'done' AND r.completed_at >= v_as_of)
        )
    ) AS pending_at_month_end,
    COUNT(r.id) FILTER (
      WHERE v_as_of > p_month_start
        AND r.created_at < v_as_of
        AND r.due_at < v_as_of
        AND (
          r.status = 'pending'
          OR (r.status = 'done' AND r.completed_at >= v_as_of)
        )
    ) AS overdue_at_month_end,
    ROUND((
      AVG(EXTRACT(EPOCH FROM (r.completed_at - r.created_at)) / 3600.0)
      FILTER (
        WHERE r.completed_at >= p_month_start
          AND r.completed_at < p_month_end
          AND r.completed_at >= r.created_at
      )
    )::numeric, 1) AS average_response_hours,
    COUNT(r.id) FILTER (
      WHERE r.completed_at >= p_month_start
        AND r.completed_at < p_month_end
        AND r.due_at IS NOT NULL
        AND r.completed_at <= r.due_at
    ) AS on_time_completed,
    COUNT(r.id) FILTER (
      WHERE r.completed_at >= p_month_start
        AND r.completed_at < p_month_end
        AND r.due_at IS NOT NULL
    ) AS on_time_eligible
  FROM public.profiles p
  LEFT JOIN public.letter_referrals r
    ON r.referred_to = p.user_id
  WHERE p.role = 'expert'
    AND p.approval_status = 'approved'
    AND COALESCE(p.is_disciplinary_committee, false) = false
  GROUP BY p.user_id, p.full_name
  ORDER BY p.full_name;
END;
$$;

REVOKE ALL ON FUNCTION public.get_monthly_secretariat_performance(timestamptz, timestamptz)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_monthly_secretariat_performance(timestamptz, timestamptz)
  TO authenticated;
