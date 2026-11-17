/*
  Repair the legacy leave review check so server-approved short leave can be inserted.
  Replaces the original start-month-only quota calculation for databases where the
  earlier migration has already been applied.
*/
ALTER TABLE public.leave_requests
  DROP CONSTRAINT IF EXISTS leave_requests_review_provenance_check;

DO $$
DECLARE
  constraint_row record;
BEGIN
  FOR constraint_row IN
    SELECT conname
    FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.leave_requests'::regclass
      AND contype = 'c'
      AND conname <> 'leave_requests_review_provenance_check'
      AND pg_catalog.pg_get_constraintdef(oid) ILIKE '%reviewed_by IS NOT NULL%'
  LOOP
    EXECUTE format('ALTER TABLE public.leave_requests DROP CONSTRAINT %I', constraint_row.conname);
  END LOOP;
END $$;

ALTER TABLE public.leave_requests
  ADD CONSTRAINT leave_requests_review_provenance_check
  CHECK (
    (status = 'pending' AND reviewed_by IS NULL AND reviewed_at IS NULL)
    OR (
      status = 'approved'
      AND (
        (reviewed_by IS NULL AND reviewed_at IS NULL)
        OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
      )
    )
    OR (status = 'rejected' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
  ) NOT VALID;

CREATE OR REPLACE FUNCTION public.set_leave_request_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_within_allowance boolean;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(NEW.driver_id::text, 0));

  IF NEW.end_date < NEW.start_date THEN
    RAISE EXCEPTION 'Leave end date cannot be earlier than start date';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.leave_requests lr
    WHERE lr.driver_id = NEW.driver_id
      AND lr.status <> 'rejected'
      AND daterange(lr.start_date, lr.end_date, '[]')
          && daterange(NEW.start_date, NEW.end_date, '[]')
  ) THEN
    RAISE EXCEPTION 'This leave period overlaps an existing non-rejected request';
  END IF;

  WITH requested_days AS (
    SELECT public.jalali_month_key(day_value::date) AS month_key,
           count(DISTINCT day_value::date)::integer AS requested_days
    FROM generate_series(
      NEW.start_date::timestamp,
      NEW.end_date::timestamp,
      interval '1 day'
    ) AS days(day_value)
    GROUP BY public.jalali_month_key(day_value::date)
  ),
  used_days AS (
    SELECT public.jalali_month_key(day_value::date) AS month_key,
           count(DISTINCT day_value::date)::integer AS used_days
    FROM public.leave_requests lr
    CROSS JOIN LATERAL generate_series(
      lr.start_date::timestamp,
      lr.end_date::timestamp,
      interval '1 day'
    ) AS days(day_value)
    WHERE lr.driver_id = NEW.driver_id
      AND lr.status <> 'rejected'
    GROUP BY public.jalali_month_key(day_value::date)
  )
  SELECT coalesce(bool_and(coalesce(u.used_days, 0) + r.requested_days <= 3), true)
  INTO v_within_allowance
  FROM requested_days r
  LEFT JOIN used_days u USING (month_key);

  NEW.status := CASE WHEN v_within_allowance THEN 'approved' ELSE 'pending' END;
  NEW.reviewed_by := NULL;
  NEW.reviewed_at := NULL;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_leave_request_status() FROM PUBLIC, anon, authenticated;
