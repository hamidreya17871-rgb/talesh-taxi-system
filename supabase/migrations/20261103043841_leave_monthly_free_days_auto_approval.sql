/*
# Automatic approval of short leave within a monthly allowance

1. Behaviour
- Each driver may take up to 3 days of leave per Solar Hijri (Jalali) month without organisation approval.
- Every day is charged to the Solar Hijri (Jalali) month in which that day falls, including requests that cross month boundaries.
- Every day from a non-rejected request counts toward its corresponding month; overlapping active requests are rejected.
- If the new request fits within the remaining allowance, it is saved as approved automatically.
- Otherwise it is saved as pending and needs review by a manager or expert.

2. New Functions
- `jalali_month_key(date)`: returns the Solar Hijri year and month as text, for example '1405-08'.
- `set_leave_request_status()`: trigger function that decides the status of each new leave request on the server, so the client cannot choose it.

3. Modified Objects
- Trigger `leave_requests_set_status` runs before each insert on `leave_requests`.
- Policy `driver_request_leave` now accepts status 'pending' or 'approved' on insert. The trigger always sets the final value, so drivers still cannot approve their own requests beyond the allowance.

4. Security
- The trigger function runs with definer rights so the allowance is counted over all of the driver's rows.
- EXECUTE on the trigger function is revoked from PUBLIC, anon and authenticated; triggers still run.
*/

CREATE OR REPLACE FUNCTION public.jalali_month_key(p_date date)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  gy integer := extract(year FROM p_date)::integer;
  gm integer := extract(month FROM p_date)::integer;
  gd integer := extract(day FROM p_date)::integer;
  month_offsets integer[] := ARRAY[0,31,59,90,120,151,181,212,243,273,304,334];
  gy2 integer;
  days integer;
  jy integer;
  jm integer;
BEGIN
  gy2 := CASE WHEN gm > 2 THEN gy + 1 ELSE gy END;
  days := 355666 + 365 * gy + (gy2 + 3) / 4 - (gy2 + 99) / 100 + (gy2 + 399) / 400 + gd + month_offsets[gm];
  jy := -1595 + 33 * (days / 12053);
  days := days % 12053;
  jy := jy + 4 * (days / 1461);
  days := days % 1461;
  IF days > 365 THEN
    jy := jy + (days - 1) / 365;
    days := (days - 1) % 365;
  END IF;
  IF days < 186 THEN
    jm := 1 + days / 31;
  ELSE
    jm := 7 + (days - 186) / 30;
  END IF;
  RETURN jy::text || '-' || lpad(jm::text, 2, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.set_leave_request_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_within_allowance boolean;
BEGIN
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
    ) AS day_value
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
    ) AS day_value
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

DROP TRIGGER IF EXISTS leave_requests_set_status ON public.leave_requests;
CREATE TRIGGER leave_requests_set_status
  BEFORE INSERT ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_leave_request_status();

DROP POLICY IF EXISTS driver_request_leave ON public.leave_requests;
CREATE POLICY driver_request_leave ON public.leave_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    driver_id = public.current_driver_id()
    AND requested_by = auth.uid()
    AND status IN ('pending', 'approved')
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
  );
