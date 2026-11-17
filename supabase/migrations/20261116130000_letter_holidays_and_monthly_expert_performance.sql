-- Manager-configurable Secretariat deadlines, official holiday calendar,
-- and monthly expert performance reporting.
-- Additive only: existing letters and referrals are preserved.

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
CREATE OR REPLACE FUNCTION public.set_letter_referral_deadline()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_priority text;
BEGIN
  SELECT l.priority INTO v_priority
  FROM public.letters l
  WHERE l.id = NEW.letter_id;

  NEW.due_at := public.calculate_letter_due_at(COALESCE(v_priority, 'normal'), NEW.created_at);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.set_letter_referral_deadline() FROM PUBLIC, anon, authenticated;

-- The preceding migration already attached these triggers to the
-- letter_priority_settings and letter_official_holidays tables. Replace their
-- function body here so changed deadlines reset their notification marker.
CREATE OR REPLACE FUNCTION public.refresh_letter_deadlines()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.letter_referrals r
  SET due_at = public.calculate_letter_due_at(l.priority, r.created_at),
      due_notified_at = CASE
        WHEN r.due_at IS DISTINCT FROM public.calculate_letter_due_at(l.priority, r.created_at)
          THEN NULL
        ELSE r.due_notified_at
      END
  FROM public.letters l
  WHERE l.id = r.letter_id
    AND r.status = 'pending';

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
REVOKE ALL ON FUNCTION public.refresh_letter_deadlines() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS letter_priority_settings_refresh_deadlines ON public.letter_priority_settings;
CREATE TRIGGER letter_priority_settings_refresh_deadlines
  AFTER UPDATE OF working_days ON public.letter_priority_settings
  FOR EACH ROW EXECUTE FUNCTION public.refresh_letter_deadlines();
DROP TRIGGER IF EXISTS letter_official_holidays_refresh_deadlines ON public.letter_official_holidays;
CREATE TRIGGER letter_official_holidays_refresh_deadlines
  AFTER INSERT OR DELETE ON public.letter_official_holidays
  FOR EACH ROW EXECUTE FUNCTION public.refresh_letter_deadlines();


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

-- Expose only a narrow aggregate RPC. SECURITY INVOKER keeps the existing RLS
-- policies active; the function also filters to managers. Managers can
-- read all staff and referrals; non-managers receive no aggregate rows.
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
      (p_month_end::timestamp AT TIME ZONE 'Asia/Tehran') AS month_end,
      LEAST((p_month_end::timestamp AT TIME ZONE 'Asia/Tehran'), now()) AS as_of
  ),
  experts AS (
    SELECT p.user_id, p.full_name
    FROM public.profiles p
    WHERE p.role = 'expert'
      AND p.is_active = true
      AND p.approval_status = 'approved'
      AND COALESCE(p.is_disciplinary_committee, false) = false
  )
  SELECT
    e.user_id,
    e.full_name,
    COUNT(r.id) FILTER (
      WHERE r.created_at >= b.month_start AND r.created_at < b.month_end
    ) AS assigned_count,
    COUNT(r.id) FILTER (
      WHERE r.completed_at >= b.month_start AND r.completed_at < b.month_end
    ) AS completed_count,
    COUNT(r.id) FILTER (
      WHERE b.as_of > b.month_start
        AND r.created_at < b.as_of
        AND (
          r.status = 'pending'
          OR (r.status = 'done' AND r.completed_at >= b.as_of)
        )
    ) AS pending_at_month_end,
    COUNT(r.id) FILTER (
      WHERE b.as_of > b.month_start
        AND r.created_at < b.as_of
        AND r.due_at < b.as_of
        AND (
          r.status = 'pending'
          OR (r.status = 'done' AND r.completed_at >= b.as_of)
        )
    ) AS overdue_at_month_end,
    ROUND((
      AVG(EXTRACT(EPOCH FROM (r.completed_at - r.created_at)) / 3600.0)
      FILTER (
        WHERE r.completed_at >= b.month_start
          AND r.completed_at < b.month_end
          AND r.completed_at >= r.created_at
      )
    )::numeric, 1) AS average_response_hours,
    COUNT(r.id) FILTER (
      WHERE r.completed_at >= b.month_start
        AND r.completed_at < b.month_end
        AND r.due_at IS NOT NULL
        AND r.completed_at <= r.due_at
    ) AS on_time_completed,
    COUNT(r.id) FILTER (
      WHERE r.completed_at >= b.month_start
        AND r.completed_at < b.month_end
        AND r.due_at IS NOT NULL
    ) AS on_time_eligible
  FROM experts e
  CROSS JOIN bounds b
  LEFT JOIN public.letter_referrals r ON r.referred_to = e.user_id
  WHERE p_month_start IS NOT NULL
    AND p_month_end IS NOT NULL
    AND p_month_start < p_month_end
    AND (SELECT public.current_app_role()) = 'manager'
  GROUP BY e.user_id, e.full_name
  ORDER BY e.full_name;
$$;

REVOKE ALL ON FUNCTION public.get_monthly_secretariat_performance(date, date)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_monthly_secretariat_performance(date, date)
  TO authenticated;

-- Record deadline recalculations in the visible letter timeline.
CREATE OR REPLACE FUNCTION public.audit_letter_workflow_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_letter_id uuid;
  v_referral_id uuid;
  v_type text;
  v_details jsonb;
  v_changed_fields text[] := ARRAY[]::text[];
BEGIN
  IF TG_TABLE_NAME = 'letters' THEN
    v_letter_id := NEW.id;
    IF TG_OP = 'INSERT' THEN
      v_type := 'letter_registered';
      v_details := jsonb_build_object('status', NEW.status, 'priority', NEW.priority);
    ELSIF NEW.priority IS DISTINCT FROM OLD.priority THEN
      v_type := 'priority_changed';
      v_details := jsonb_build_object('from', OLD.priority, 'to', NEW.priority);
    ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
      v_type := 'status_changed';
      v_details := jsonb_build_object('from', OLD.status, 'to', NEW.status);
    ELSE
      IF NEW.subject IS DISTINCT FROM OLD.subject THEN v_changed_fields := array_append(v_changed_fields, 'subject'); END IF;
      IF NEW.body IS DISTINCT FROM OLD.body THEN v_changed_fields := array_append(v_changed_fields, 'body'); END IF;
      IF NEW.correspondent IS DISTINCT FROM OLD.correspondent THEN v_changed_fields := array_append(v_changed_fields, 'correspondent'); END IF;
      IF NEW.letter_no IS DISTINCT FROM OLD.letter_no THEN v_changed_fields := array_append(v_changed_fields, 'letter_no'); END IF;
      IF NEW.letter_date IS DISTINCT FROM OLD.letter_date THEN v_changed_fields := array_append(v_changed_fields, 'letter_date'); END IF;
      IF NEW.attachment_path IS DISTINCT FROM OLD.attachment_path THEN v_changed_fields := array_append(v_changed_fields, 'attachment_path'); END IF;
      IF cardinality(v_changed_fields) = 0 THEN RETURN NEW; END IF;
      v_type := 'letter_edited';
      v_details := jsonb_build_object('changed_fields', v_changed_fields);
    END IF;
  ELSE
    v_letter_id := NEW.letter_id;
    v_referral_id := NEW.id;
    IF TG_OP = 'INSERT' THEN
      v_type := 'referred';
      v_details := jsonb_build_object('to', NEW.referred_to, 'action', NEW.action, 'note', NEW.note);
    ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
      v_type := CASE WHEN NEW.status = 'done' THEN 'referral_completed' ELSE 'referral_status_changed' END;
      v_details := jsonb_build_object('from', OLD.status, 'to', NEW.status);
    ELSIF NEW.due_at IS DISTINCT FROM OLD.due_at THEN
      v_type := 'deadline_changed';
      v_details := jsonb_build_object('from', OLD.due_at, 'to', NEW.due_at);
    ELSE
      RETURN NEW;
    END IF;
  END IF;

  IF TG_TABLE_NAME = 'letter_referrals' THEN
    IF TG_OP = 'INSERT' THEN
      UPDATE public.letters l
      SET response_due_at = (
        SELECT min(r.due_at) FROM public.letter_referrals r
        WHERE r.letter_id = NEW.letter_id AND r.status = 'pending'
      )
      WHERE l.id = NEW.letter_id;
    ELSIF NEW.status IS DISTINCT FROM OLD.status OR NEW.due_at IS DISTINCT FROM OLD.due_at THEN
      UPDATE public.letters l
      SET response_due_at = (
        SELECT min(r.due_at) FROM public.letter_referrals r
        WHERE r.letter_id = NEW.letter_id AND r.status = 'pending'
      )
      WHERE l.id = NEW.letter_id;
    END IF;
  END IF;

  INSERT INTO public.letter_workflow_events(letter_id, referral_id, actor_id, event_type, details)
  VALUES (v_letter_id, v_referral_id, auth.uid(), v_type, COALESCE(v_details, '{}'::jsonb));
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.audit_letter_workflow_event() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS referrals_workflow_audit ON public.letter_referrals;
CREATE TRIGGER referrals_workflow_audit
  AFTER INSERT OR UPDATE OF status, due_at ON public.letter_referrals
  FOR EACH ROW EXECUTE FUNCTION public.audit_letter_workflow_event();
