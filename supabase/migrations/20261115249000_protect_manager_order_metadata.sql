-- Manager-order metadata must never be written by inspectors or committee members.
CREATE OR REPLACE FUNCTION public.guard_manager_order_metadata()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF (
       NEW.settlement_approved_by IS DISTINCT FROM OLD.settlement_approved_by
       OR NEW.settlement_approved_at IS DISTINCT FROM OLD.settlement_approved_at
       OR NEW.settlement_order_note IS DISTINCT FROM OLD.settlement_order_note
       OR NEW.referral_order_by IS DISTINCT FROM OLD.referral_order_by
       OR NEW.referral_order_at IS DISTINCT FROM OLD.referral_order_at
       OR NEW.referral_order_note IS DISTINCT FROM OLD.referral_order_note
       OR NEW.verdict_approved_by IS DISTINCT FROM OLD.verdict_approved_by
       OR NEW.verdict_approved_at IS DISTINCT FROM OLD.verdict_approved_at
       OR NEW.verdict_order_note IS DISTINCT FROM OLD.verdict_order_note
     ) THEN
    IF public.current_app_role() IS DISTINCT FROM 'manager' THEN
      RAISE EXCEPTION 'Only the organization manager may write manager order metadata';
    END IF;
    IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Manager order metadata must be written with its approved status transition';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_manager_order_metadata ON public.line_violation_reports;
CREATE TRIGGER guard_manager_order_metadata
  BEFORE UPDATE OF
    settlement_approved_by, settlement_approved_at, settlement_order_note,
    referral_order_by, referral_order_at, referral_order_note,
    verdict_approved_by, verdict_approved_at, verdict_order_note
  ON public.line_violation_reports
  FOR EACH ROW EXECUTE FUNCTION public.guard_manager_order_metadata();

REVOKE ALL ON FUNCTION public.guard_manager_order_metadata() FROM PUBLIC, anon, authenticated;
