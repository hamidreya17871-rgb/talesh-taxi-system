/*
  Three-eyes workflow hardening:
  - organization inspector prepares outcomes, never closes/refers directly
  - manager orders settlement closure or committee referral
  - committee issues verdict
  - manager approves/signs internal decision and orders finalization
  - immutable status-event history
*/
ALTER TABLE public.line_violation_reports
  ADD COLUMN IF NOT EXISTS settlement_approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS settlement_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS settlement_order_note text,
  ADD COLUMN IF NOT EXISTS referral_order_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS referral_order_at timestamptz,
  ADD COLUMN IF NOT EXISTS referral_order_note text,
  ADD COLUMN IF NOT EXISTS verdict_approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verdict_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS verdict_order_note text;

ALTER TABLE public.line_violation_reports
  DROP CONSTRAINT IF EXISTS line_violation_reports_status_check;
ALTER TABLE public.line_violation_reports
  ADD CONSTRAINT line_violation_reports_status_check CHECK (status IN (
    'ارسال‌شده',
    'دریافت توسط بازرس سازمان',
    'در حال بررسی',
    'ارجاع به مدیریت', -- legacy status retained for existing reports
    'سازش انجام شد',
    'در انتظار تأیید سازش توسط مدیر',
    'در انتظار دستور مدیر برای ارجاع',
    'ارجاع به کمیته انضباطی',
    'رأی صادر شد - در انتظار تأیید مدیر',
    'تأیید نهایی رأی',
    'مختومه'
  ));

ALTER TABLE public.line_violation_reports
  ADD CONSTRAINT line_violation_reports_committee_decision_check
  CHECK (
    committee_decision IS NULL OR committee_decision IN (
      'عدم احراز تخلف','تذکر کتبی','اخطار رسمی','تعلیق موقت فعالیت',
      'پیشنهاد لغو پروانه فعالیت','تکمیل تحقیقات و ارائه مستندات'
    )
  );

-- Only non-committee experts and managers may work in the organization-inspection queue.
DROP POLICY IF EXISTS organization_inspector_read_reports ON public.line_violation_reports;
CREATE POLICY organization_inspector_read_reports
  ON public.line_violation_reports FOR SELECT TO authenticated
  USING (
    public.current_app_role() = 'manager'
    OR (
      public.current_app_role() = 'expert'
      AND NOT EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.user_id = auth.uid() AND p.is_disciplinary_committee
      )
    )
  );

DROP POLICY IF EXISTS organization_inspector_update_reports ON public.line_violation_reports;
CREATE POLICY organization_inspector_update_reports
  ON public.line_violation_reports FOR UPDATE TO authenticated
  USING (
    status NOT IN ('ارجاع به کمیته انضباطی','رأی صادر شد - در انتظار تأیید مدیر','تأیید نهایی رأی','مختومه')
    AND (
      public.current_app_role() = 'manager'
      OR (
        public.current_app_role() = 'expert'
        AND NOT EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.user_id = auth.uid() AND p.is_disciplinary_committee
        )
      )
    )
  )
  WITH CHECK (
    status IN ('ارسال‌شده','دریافت توسط بازرس سازمان','در حال بررسی','سازش انجام شد',
               'در انتظار تأیید سازش توسط مدیر','در انتظار دستور مدیر برای ارجاع')
    AND (
      public.current_app_role() = 'manager'
      OR (
        public.current_app_role() = 'expert'
        AND NOT EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.user_id = auth.uid() AND p.is_disciplinary_committee
        )
      )
    )
    AND committee_decision IS NULL
    AND committee_decided_by IS NULL
    AND committee_decided_at IS NULL
    AND (
      status NOT IN ('در انتظار تأیید سازش توسط مدیر','در انتظار دستور مدیر برای ارجاع')
      OR (
        settlement_attempted_at IS NOT NULL
        AND length(trim(coalesce(settlement_note,''))) >= 5
      )
    )
  );

-- Committee members see only cases in the committee phase, not the general inspection queue.
DROP POLICY IF EXISTS disciplinary_committee_read_referred ON public.line_violation_reports;
CREATE POLICY disciplinary_committee_read_referred
  ON public.line_violation_reports FOR SELECT TO authenticated
  USING (
    status IN ('ارجاع به کمیته انضباطی','رأی صادر شد - در انتظار تأیید مدیر','تأیید نهایی رأی')
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.role = 'expert'
        AND p.is_active AND p.approval_status = 'approved'
        AND p.is_disciplinary_committee
    )
  );

-- Manager approval is a separate permission and a separate transition.
GRANT UPDATE (
  status,
  settlement_approved_by, settlement_approved_at, settlement_order_note,
  referral_order_by, referral_order_at, referral_order_note,
  verdict_approved_by, verdict_approved_at, verdict_order_note
) ON public.line_violation_reports TO authenticated;

DROP POLICY IF EXISTS manager_approve_report_stage ON public.line_violation_reports;
CREATE POLICY manager_approve_report_stage
  ON public.line_violation_reports FOR UPDATE TO authenticated
  USING (
    public.current_app_role() = 'manager'
    AND status IN (
      'در انتظار تأیید سازش توسط مدیر',
      'در انتظار دستور مدیر برای ارجاع',
      'رأی صادر شد - در انتظار تأیید مدیر'
    )
  )
  WITH CHECK (
    public.current_app_role() = 'manager'
    AND (
      (
        status = 'مختومه'
        AND settlement_approved_by = auth.uid()
        AND settlement_approved_at IS NOT NULL
        AND length(trim(coalesce(settlement_order_note,''))) >= 5
      )
      OR
      (
        status = 'ارجاع به کمیته انضباطی'
        AND referral_order_by = auth.uid()
        AND referral_order_at IS NOT NULL
        AND length(trim(coalesce(referral_order_note,''))) >= 5
        AND settlement_attempted_at IS NOT NULL
        AND length(trim(coalesce(settlement_note,''))) >= 5
      )
      OR
      (
        status = 'تأیید نهایی رأی'
        AND verdict_approved_by = auth.uid()
        AND verdict_approved_at IS NOT NULL
        AND length(trim(coalesce(verdict_order_note,''))) >= 5
        AND committee_decision IS NOT NULL
        AND committee_decided_by IS NOT NULL
        AND committee_decided_at IS NOT NULL
      )
    )
  );

-- Immutable, minimal audit trail for each status transition.
CREATE TABLE IF NOT EXISTS public.line_violation_report_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  report_id uuid NOT NULL REFERENCES public.line_violation_reports(id) ON DELETE RESTRICT,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  old_status text,
  new_status text NOT NULL,
  event_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS line_violation_report_events_report_idx
  ON public.line_violation_report_events(report_id, event_at DESC);
ALTER TABLE public.line_violation_report_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.line_violation_report_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.line_violation_report_events TO authenticated;

DROP POLICY IF EXISTS report_events_read_authorized ON public.line_violation_report_events;
CREATE POLICY report_events_read_authorized
  ON public.line_violation_report_events FOR SELECT TO authenticated
  USING (
    public.current_app_role() IN ('manager','expert')
    AND EXISTS (
      SELECT 1 FROM public.line_violation_reports r
      WHERE r.id = report_id
        AND (
          public.current_app_role() = 'manager'
          OR (
            public.current_app_role() = 'expert'
            AND NOT EXISTS (
              SELECT 1 FROM public.profiles p
              WHERE p.user_id = auth.uid() AND p.is_disciplinary_committee
            )
          )
          OR EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.user_id = auth.uid() AND p.is_disciplinary_committee
              AND r.status IN ('ارجاع به کمیته انضباطی','رأی صادر شد - در انتظار تأیید مدیر','تأیید نهایی رأی')
          )
        )
    )
  );

CREATE OR REPLACE FUNCTION public.log_line_violation_report_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.line_violation_report_events(report_id, actor_id, old_status, new_status)
    VALUES (NEW.id, auth.uid(), NULL, NEW.status);
  ELSIF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.line_violation_report_events(report_id, actor_id, old_status, new_status)
    VALUES (NEW.id, auth.uid(), OLD.status, NEW.status);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.log_line_violation_report_status() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS line_violation_report_status_audit ON public.line_violation_reports;
CREATE TRIGGER line_violation_report_status_audit
  AFTER INSERT OR UPDATE OF status ON public.line_violation_reports
  FOR EACH ROW EXECUTE FUNCTION public.log_line_violation_report_status();
