/*
# Driver objections to violation rulings

1. Modified Tables
- `violations`: three new columns record a driver's one-time objection.
  - `objection_text` (text): the driver's written objection.
  - `objection_submitted_at` (timestamptz): when the objection was filed. Set once; it is the marker that the one allowed objection has been used.
  - `objection_decision` (text): staff decision, one of 'در انتظار بررسی', 'پذیرفته شد', 'رد شد'. Set by staff only.

2. New Function
- `submit_violation_objection(p_violation_id, p_text)`: lets a signed-in driver file an objection on their own violation.
  - Rejects text shorter than 10 or longer than 2000 characters.
  - Only succeeds for a violation linked to the caller's driver record, and only when no objection exists yet.
  - Runs with elevated rights so the driver never needs direct UPDATE access to the violations table.

3. Security
- Drivers keep read-only access to violations; they cannot edit rows directly.
- EXECUTE on the function is revoked from PUBLIC and anon and granted to authenticated only.
- Managers and experts keep their existing update access, so they can record the decision.
*/

ALTER TABLE violations ADD COLUMN IF NOT EXISTS objection_text text;
ALTER TABLE violations ADD COLUMN IF NOT EXISTS objection_submitted_at timestamptz;
ALTER TABLE violations ADD COLUMN IF NOT EXISTS objection_decision text;

CREATE OR REPLACE FUNCTION public.submit_violation_objection(p_violation_id uuid, p_text text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_text text := btrim(coalesce(p_text, ''));
BEGIN
  IF char_length(v_text) < 10 THEN
    RAISE EXCEPTION 'متن اعتراض باید حداقل ۱۰ نویسه باشد';
  END IF;
  IF char_length(v_text) > 2000 THEN
    RAISE EXCEPTION 'متن اعتراض نباید بیش از ۲۰۰۰ نویسه باشد';
  END IF;

  UPDATE public.violations
  SET objection_text = v_text,
      objection_submitted_at = now(),
      objection_decision = 'در انتظار بررسی'
  WHERE id = p_violation_id
    AND driver_id = public.current_driver_id()
    AND objection_submitted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'امکان ثبت اعتراض برای این تخلف وجود ندارد';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_violation_objection(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_violation_objection(uuid, text) TO authenticated;
