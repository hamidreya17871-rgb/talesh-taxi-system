-- Manager-configurable Secretariat deadlines, official holiday calendar,
-- and monthly expert performance reporting.
-- Additive only: existing letters and referrals are preserved.

CREATE TABLE IF NOT EXISTS public.letter_official_holidays (
  holiday_date date PRIMARY KEY,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL
);

ALTER TABLE public.letter_official_holidays ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS letter_official_holidays_manager_read ON public.letter_official_holidays;
CREATE POLICY letter_official_holidays_manager_read
  ON public.letter_official_holidays
  FOR SELECT TO authenticated
  USING ((SELECT public.current_app_role()) = 'manager');
DROP POLICY IF EXISTS letter_official_holidays_manager_insert ON public.letter_official_holidays;
CREATE POLICY letter_official_holidays_manager_insert
  ON public.letter_official_holidays
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.current_app_role()) = 'manager'
    AND created_by = (SELECT auth.uid())
  );
DROP POLICY IF EXISTS letter_official_holidays_manager_delete ON public.letter_official_holidays;
CREATE POLICY letter_official_holidays_manager_delete
  ON public.letter_official_holidays
  FOR DELETE TO authenticated
  USING ((SELECT public.current_app_role()) = 'manager');

REVOKE ALL ON public.letter_official_holidays FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.letter_official_holidays TO authenticated;

-- Calculate in Iran local calendar time. Thursday (4) and Friday (5)
-- are non-working days; dates in the manager-maintained holiday table are skipped.
CREATE OR REPLACE FUNCTION public.calculate_letter_due_at(
  p_priority text,
  p_start timestamptz DEFAULT now()
)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  v_days integer;
  v_local_start timestamp;
  v_local_date date;
  v_local_time time;
  v_added integer := 0;
BEGIN
  SELECT s.working_days INTO v_days
  FROM public.letter_priority_settings s
  WHERE s.priority = p_priority;

  IF v_days IS NULL THEN
    RAISE EXCEPTION 'اولویت نامه معتبر نیست.' USING ERRCODE = '22023';
  END IF;

  v_local_start := p_start AT TIME ZONE 'Asia/Tehran';
  v_local_date := v_local_start::date;
  v_local_time := v_local_start::time;

  WHILE v_added < v_days LOOP
    v_local_date := v_local_date + 1;
    IF extract(isodow FROM v_local_date)::integer NOT IN (4, 5)
       AND NOT EXISTS (
         SELECT 1 FROM public.letter_official_holidays h
         WHERE h.holiday_date = v_local_date
       ) THEN
      v_added := v_added + 1;
    END IF;
  END LOOP;

  RETURN (v_local_date + v_local_time) AT TIME ZONE 'Asia/Tehran';
END;
$$;
REVOKE ALL ON FUNCTION public.calculate_letter_due_at(text, timestamptz) FROM PUBLIC, anon, authenticated;

-- Recalculate only open referrals after a holiday or a priority duration changes.
CREATE OR REPLACE FUNCTION public.refresh_open_letter_deadlines()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.letter_referrals r
  SET due_at = public.calculate_letter_due_at(
        COALESCE((SELECT l.priority FROM public.letters l WHERE l.id = r.letter_id), 'normal'),
        r.created_at
      ),
      due_notified_at = CASE
        WHEN r.due_at IS DISTINCT FROM public.calculate_letter_due_at(
          COALESCE((SELECT l.priority FROM public.letters l WHERE l.id = r.letter_id), 'normal'),
          r.created_at
        ) THEN NULL
        ELSE r.due_notified_at
      END
  WHERE r.status = 'pending';

  UPDATE public.letters l
  SET response_due_at = (
    SELECT min(r.due_at)
    FROM public.letter_referrals r
    WHERE r.letter_id = l.id AND r.status = 'pending'
  )
  WHERE EXISTS (
    SELECT 1 FROM public.letter_referrals r
    WHERE r.letter_id = l.id AND r.status = 'pending'
  );

  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.refresh_open_letter_deadlines() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS letter_holidays_refresh_deadlines ON public.letter_official_holidays;
CREATE TRIGGER letter_holidays_refresh_deadlines
  AFTER INSERT OR UPDATE OR DELETE ON public.letter_official_holidays
  FOR EACH ROW EXECUTE FUNCTION public.refresh_open_letter_deadlines();

DROP TRIGGER IF EXISTS letter_priority_settings_refresh_deadlines ON public.letter_priority_settings;
CREATE TRIGGER letter_priority_settings_refresh_deadlines
  AFTER UPDATE OF working_days ON public.letter_priority_settings
  FOR EACH ROW EXECUTE FUNCTION public.refresh_open_letter_deadlines();

-- Apply the updated holiday-aware calculation to all currently open referrals.
UPDATE public.letter_referrals r
SET due_at = public.calculate_letter_due_at(
  COALESCE((SELECT l.priority FROM public.letters l WHERE l.id = r.letter_id), 'normal'),
  r.created_at
)
WHERE r.status = 'pending';

UPDATE public.letters l
SET response_due_at = (
  SELECT min(r.due_at)
  FROM public.letter_referrals r
  WHERE r.letter_id = l.id AND r.status = 'pending'
)
WHERE EXISTS (
  SELECT 1 FROM public.letter_referrals r
  WHERE r.letter_id = l.id AND r.status = 'pending'
);

CREATE INDEX IF NOT EXISTS letter_referrals_monthly_performance_idx
  ON public.letter_referrals (referred_to, created_at, completed_at);

-- SECURITY INVOKER is intentional: RLS on profiles and letter_referrals remains
-- in force. Only an authenticated manager receives aggregate results.
CREATE OR REPLACE FUNCTION public.get_monthly_secretariat_performance(
  p_month_start date,
  p_month_end date
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
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  WITH bounds AS (
    SELECT
      (p_month_start::timestamp AT TIME ZONE 'Asia/Tehran') AS month_start,
      (p_month_end::timestamp AT TIME ZONE 'Asia/Tehran') AS month_end
  ),
  experts AS (
    SELECT p.user_id, p.full_name
    FROM public.profiles p
    WHERE p.role = 'expert'
      AND p.is_active = true
      AND p.approval_status = 'approved'
      AND COALESCE(p.is_disciplinary_committee, false) = false
  ),
  metrics AS (
    SELECT
      r.referred_to,
      count(*) FILTER (
        WHERE (r.created_at AT TIME ZONE 'Asia/Tehran')::date >= p_month_start
          AND (r.created_at AT TIME ZONE 'Asia/Tehran')::date < p_month_end
      ) AS assigned_count,
      count(*) FILTER (
        WHERE r.completed_at IS NOT NULL
          AND r.completed_at >= b.month_start
          AND r.completed_at < b.month_end
      ) AS completed_count,
      count(*) FILTER (
        WHERE r.created_at < b.month_end
          AND (
            (r.status = 'pending' AND (r.completed_at IS NULL OR r.completed_at >= b.month_end))
            OR (r.status = 'done' AND r.completed_at IS NOT NULL AND r.completed_at >= b.month_end)
          )
      ) AS pending_at_month_end,
      count(*) FILTER (
        WHERE r.created_at < b.month_end
          AND r.due_at < b.month_end
          AND (
            (r.status = 'pending' AND (r.completed_at IS NULL OR r.completed_at >= b.month_end))
            OR (r.status = 'done' AND r.completed_at IS NOT NULL AND r.completed_at >= b.month_end)
          )
      ) AS overdue_at_month_end,
      round(avg(extract(epoch FROM (r.completed_at - r.created_at)) / 3600.0) FILTER (
        WHERE r.completed_at IS NOT NULL
          AND r.completed_at >= b.month_start
          AND r.completed_at < b.month_end
      )::numeric, 1) AS average_response_hours,
      count(*) FILTER (
        WHERE r.completed_at IS NOT NULL
          AND r.completed_at >= b.month_start
          AND r.completed_at < b.month_end
          AND r.due_at IS NOT NULL
          AND r.completed_at <= r.due_at
      ) AS on_time_completed,
      count(*) FILTER (
        WHERE r.completed_at IS NOT NULL
          AND r.completed_at >= b.month_start
          AND r.completed_at < b.month_end
          AND r.due_at IS NOT NULL
      ) AS on_time_eligible
    FROM public.letter_referrals r
    CROSS JOIN bounds b
    WHERE r.created_at < b.month_end
    GROUP BY r.referred_to
  )
  SELECT
    e.user_id,
    e.full_name,
    COALESCE(m.assigned_count, 0),
    COALESCE(m.completed_count, 0),
    COALESCE(m.pending_at_month_end, 0),
    COALESCE(m.overdue_at_month_end, 0),
    m.average_response_hours,
    COALESCE(m.on_time_completed, 0),
    COALESCE(m.on_time_eligible, 0)
  FROM experts e
  LEFT JOIN metrics m ON m.referred_to = e.user_id
  WHERE (SELECT public.current_app_role()) = 'manager'
    AND p_month_start < p_month_end
  ORDER BY e.full_name;
$$;

REVOKE ALL ON FUNCTION public.get_monthly_secretariat_performance(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_monthly_secretariat_performance(date, date) TO authenticated;
