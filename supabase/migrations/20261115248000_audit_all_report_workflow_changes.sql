-- Extend the immutable event ledger to capture changes to review notes, verdicts and manager orders.
ALTER TABLE public.line_violation_report_events
  ADD COLUMN IF NOT EXISTS event_type text NOT NULL DEFAULT 'status_changed',
  ADD COLUMN IF NOT EXISTS changed_fields jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.log_line_violation_report_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_changes jsonb := '{}'::jsonb;
  v_old jsonb;
  v_new jsonb;
  v_field text;
  v_fields text[] := ARRAY[
    'status','reviewed_by','reviewed_at','review_note',
    'settlement_note','settlement_attempted_at','committee_referred_at',
    'committee_decision','committee_note','committee_decided_by','committee_decided_at',
    'settlement_approved_by','settlement_approved_at','settlement_order_note',
    'referral_order_by','referral_order_at','referral_order_note',
    'verdict_approved_by','verdict_approved_at','verdict_order_note'
  ];
  v_event_type text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.line_violation_report_events(
      report_id, actor_id, old_status, new_status, event_type, changed_fields
    )
    VALUES (
      NEW.id, auth.uid(), NULL, NEW.status, 'created',
      jsonb_build_object('status', jsonb_build_object('old', NULL, 'new', NEW.status))
    );
    RETURN NEW;
  END IF;

  v_old := to_jsonb(OLD);
  v_new := to_jsonb(NEW);
  FOREACH v_field IN ARRAY v_fields LOOP
    IF v_old -> v_field IS DISTINCT FROM v_new -> v_field THEN
      v_changes := v_changes || jsonb_build_object(
        v_field,
        jsonb_build_object('old', v_old -> v_field, 'new', v_new -> v_field)
      );
    END IF;
  END LOOP;

  IF v_changes <> '{}'::jsonb THEN
    v_event_type := CASE
      WHEN OLD.status IS DISTINCT FROM NEW.status THEN 'status_changed'
      ELSE 'workflow_details_changed'
    END;
    INSERT INTO public.line_violation_report_events(
      report_id, actor_id, old_status, new_status, event_type, changed_fields
    )
    VALUES (NEW.id, auth.uid(), OLD.status, NEW.status, v_event_type, v_changes);
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.log_line_violation_report_status() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS line_violation_report_status_audit ON public.line_violation_reports;
CREATE TRIGGER line_violation_report_status_audit
  AFTER INSERT OR UPDATE OF
    status, reviewed_by, reviewed_at, review_note,
    settlement_note, settlement_attempted_at, committee_referred_at,
    committee_decision, committee_note, committee_decided_by, committee_decided_at,
    settlement_approved_by, settlement_approved_at, settlement_order_note,
    referral_order_by, referral_order_at, referral_order_note,
    verdict_approved_by, verdict_approved_at, verdict_order_note
  ON public.line_violation_reports
  FOR EACH ROW EXECUTE FUNCTION public.log_line_violation_report_status();
