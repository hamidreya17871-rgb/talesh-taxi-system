-- Enforce the exact sequence at the database boundary, not only in the UI.
ALTER TABLE public.line_violation_reports
  DROP CONSTRAINT IF EXISTS line_violation_reports_committee_decision_check;
ALTER TABLE public.line_violation_reports
  ADD CONSTRAINT line_violation_reports_committee_decision_check
  CHECK (
    committee_decision IS NULL OR committee_decision IN (
      'عدم احراز تخلف','تذکر کتبی','اخطار رسمی','تعلیق موقت فعالیت',
      'پیشنهاد لغو پروانه فعالیت','تکمیل تحقیقات و ارائه مستندات'
    )
  );

CREATE OR REPLACE FUNCTION public.enforce_line_violation_report_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_role text;
  v_is_committee boolean;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  v_role := public.current_app_role();
  SELECT coalesce(p.is_disciplinary_committee, false)
    INTO v_is_committee
  FROM public.profiles p
  WHERE p.user_id = auth.uid();

  IF OLD.status = 'ارسال‌شده'
     AND NEW.status = 'دریافت توسط بازرس سازمان'
     AND v_role IN ('manager','expert') AND NOT v_is_committee THEN
    IF NEW.reviewed_by IS DISTINCT FROM auth.uid() OR NEW.reviewed_at IS NULL THEN
      RAISE EXCEPTION 'Inspector receipt must be attributed to the signed-in reviewer';
    END IF;
  ELSIF OLD.status = 'دریافت توسط بازرس سازمان'
     AND NEW.status = 'در حال بررسی'
     AND v_role IN ('manager','expert') AND NOT v_is_committee THEN
    IF NEW.reviewed_by IS DISTINCT FROM auth.uid() OR NEW.reviewed_at IS NULL THEN
      RAISE EXCEPTION 'Inspection start must be attributed to the signed-in reviewer';
    END IF;
  ELSIF OLD.status = 'در حال بررسی'
     AND NEW.status IN ('در انتظار تأیید سازش توسط مدیر','در انتظار دستور مدیر برای ارجاع')
     AND v_role IN ('manager','expert') AND NOT v_is_committee THEN
    IF NEW.reviewed_by IS DISTINCT FROM auth.uid()
       OR NEW.reviewed_at IS NULL
       OR NEW.settlement_attempted_at IS NULL
       OR length(trim(coalesce(NEW.settlement_note,''))) < 5 THEN
      RAISE EXCEPTION 'A documented settlement attempt by the reviewer is required';
    END IF;
  ELSIF OLD.status = 'در انتظار تأیید سازش توسط مدیر'
     AND NEW.status = 'مختومه'
     AND v_role = 'manager' THEN
    IF NEW.settlement_approved_by IS DISTINCT FROM auth.uid()
       OR NEW.settlement_approved_at IS NULL
       OR length(trim(coalesce(NEW.settlement_order_note,''))) < 5 THEN
      RAISE EXCEPTION 'Manager settlement approval and order are required';
    END IF;
  ELSIF OLD.status = 'در انتظار دستور مدیر برای ارجاع'
     AND NEW.status = 'ارجاع به کمیته انضباطی'
     AND v_role = 'manager' THEN
    IF NEW.referral_order_by IS DISTINCT FROM auth.uid()
       OR NEW.referral_order_at IS NULL
       OR length(trim(coalesce(NEW.referral_order_note,''))) < 5 THEN
      RAISE EXCEPTION 'Manager referral order is required';
    END IF;
  ELSIF OLD.status = 'ارجاع به کمیته انضباطی'
     AND NEW.status = 'رأی صادر شد - در انتظار تأیید مدیر'
     AND v_role = 'expert' AND v_is_committee THEN
    IF NEW.committee_decided_by IS DISTINCT FROM auth.uid()
       OR NEW.committee_decided_at IS NULL
       OR NEW.committee_decision IS NULL THEN
      RAISE EXCEPTION 'A committee member must issue and sign the verdict';
    END IF;
  ELSIF OLD.status = 'رأی صادر شد - در انتظار تأیید مدیر'
     AND NEW.status = 'تأیید نهایی رأی'
     AND v_role = 'manager' THEN
    IF NEW.verdict_approved_by IS DISTINCT FROM auth.uid()
       OR NEW.verdict_approved_at IS NULL
       OR length(trim(coalesce(NEW.verdict_order_note,''))) < 5 THEN
      RAISE EXCEPTION 'Manager verdict approval and execution order are required';
    END IF;
  ELSE
    RAISE EXCEPTION 'Invalid or unauthorized report status transition: % -> %', OLD.status, NEW.status;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_line_violation_report_transition ON public.line_violation_reports;
CREATE TRIGGER enforce_line_violation_report_transition
  BEFORE UPDATE OF status ON public.line_violation_reports
  FOR EACH ROW EXECUTE FUNCTION public.enforce_line_violation_report_transition();
