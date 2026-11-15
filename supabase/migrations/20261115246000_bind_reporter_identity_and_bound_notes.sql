-- Bind the displayed reporter identity to the authenticated line-inspector profile.
DROP POLICY IF EXISTS line_inspector_submit_report ON public.line_violation_reports;
CREATE POLICY line_inspector_submit_report
  ON public.line_violation_reports FOR INSERT TO authenticated
  WITH CHECK (
    reporter_user_id = auth.uid()
    AND reporter_driver_id = public.current_driver_id()
    AND status = 'ارسال‌شده'
    AND reviewed_by IS NULL AND reviewed_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.role = 'driver'
        AND p.is_active
        AND p.approval_status = 'approved'
        AND p.is_line_inspector
        AND reporter_name = p.full_name
        AND reporter_phone IS NOT DISTINCT FROM p.phone
    )
  );

-- Bound all narrative fields to prevent oversized audit and workflow records.
ALTER TABLE public.line_violation_reports
  DROP CONSTRAINT IF EXISTS line_violation_reports_settlement_note_length_check,
  DROP CONSTRAINT IF EXISTS line_violation_reports_review_note_length_check,
  DROP CONSTRAINT IF EXISTS line_violation_reports_committee_note_length_check,
  DROP CONSTRAINT IF EXISTS line_violation_reports_settlement_order_note_length_check,
  DROP CONSTRAINT IF EXISTS line_violation_reports_referral_order_note_length_check,
  DROP CONSTRAINT IF EXISTS line_violation_reports_verdict_order_note_length_check;

ALTER TABLE public.line_violation_reports
  ADD CONSTRAINT line_violation_reports_settlement_note_length_check
    CHECK (settlement_note IS NULL OR char_length(settlement_note) <= 3000) NOT VALID,
  ADD CONSTRAINT line_violation_reports_review_note_length_check
    CHECK (review_note IS NULL OR char_length(review_note) <= 3000) NOT VALID,
  ADD CONSTRAINT line_violation_reports_committee_note_length_check
    CHECK (committee_note IS NULL OR char_length(committee_note) <= 3000) NOT VALID,
  ADD CONSTRAINT line_violation_reports_settlement_order_note_length_check
    CHECK (settlement_order_note IS NULL OR char_length(settlement_order_note) <= 3000) NOT VALID,
  ADD CONSTRAINT line_violation_reports_referral_order_note_length_check
    CHECK (referral_order_note IS NULL OR char_length(referral_order_note) <= 3000) NOT VALID,
  ADD CONSTRAINT line_violation_reports_verdict_order_note_length_check
    CHECK (verdict_order_note IS NULL OR char_length(verdict_order_note) <= 3000) NOT VALID;

CREATE OR REPLACE FUNCTION public.require_committee_referral_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF OLD.status = 'در انتظار دستور مدیر برای ارجاع'
     AND NEW.status = 'ارجاع به کمیته انضباطی'
     AND NEW.committee_referred_at IS NULL THEN
    RAISE EXCEPTION 'Committee referral timestamp is required';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS require_committee_referral_timestamp ON public.line_violation_reports;
CREATE TRIGGER require_committee_referral_timestamp
  BEFORE UPDATE OF status ON public.line_violation_reports
  FOR EACH ROW EXECUTE FUNCTION public.require_committee_referral_timestamp();

REVOKE ALL ON FUNCTION public.require_committee_referral_timestamp() FROM PUBLIC, anon, authenticated;
