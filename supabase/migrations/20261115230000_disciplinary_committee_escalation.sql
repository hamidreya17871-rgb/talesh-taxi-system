/*
  Formal escalation from organization inspection to disciplinary committee.
  Inspection must record attempted settlement before referral.
*/
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_disciplinary_committee boolean NOT NULL DEFAULT false;

GRANT UPDATE (is_disciplinary_committee) ON public.profiles TO authenticated;
DROP POLICY IF EXISTS manager_assign_disciplinary_committee ON public.profiles;
CREATE POLICY manager_assign_disciplinary_committee
  ON public.profiles FOR UPDATE TO authenticated
  USING (public.current_app_role() = 'manager')
  WITH CHECK (public.current_app_role() = 'manager');

ALTER TABLE public.line_violation_reports
  ADD COLUMN IF NOT EXISTS settlement_note text,
  ADD COLUMN IF NOT EXISTS settlement_attempted_at timestamptz,
  ADD COLUMN IF NOT EXISTS committee_referred_at timestamptz,
  ADD COLUMN IF NOT EXISTS committee_decision text,
  ADD COLUMN IF NOT EXISTS committee_note text,
  ADD COLUMN IF NOT EXISTS committee_decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS committee_decided_at timestamptz;

ALTER TABLE public.line_violation_reports
  DROP CONSTRAINT IF EXISTS line_violation_reports_status_check;
ALTER TABLE public.line_violation_reports
  ADD CONSTRAINT line_violation_reports_status_check CHECK (status IN (
    'ارسال‌شده',
    'دریافت توسط بازرس سازمان',
    'در حال بررسی',
    'سازش انجام شد',
    'ارجاع به کمیته انضباطی',
    'رأی صادر شد - در انتظار تأیید مدیر',
    'تأیید نهایی رأی',
    'مختومه'
  ));

REVOKE UPDATE ON public.line_violation_reports FROM authenticated;
GRANT UPDATE (status, reviewed_by, reviewed_at, review_note, settlement_note, settlement_attempted_at, committee_referred_at)
  ON public.line_violation_reports TO authenticated;
GRANT UPDATE (committee_decision, committee_note, committee_decided_by, committee_decided_at, status)
  ON public.line_violation_reports TO authenticated;

DROP POLICY IF EXISTS organization_inspector_update_reports ON public.line_violation_reports;
CREATE POLICY organization_inspector_update_reports
  ON public.line_violation_reports FOR UPDATE TO authenticated
  USING (
    public.current_app_role() IN ('manager', 'expert')
    AND status <> 'ارجاع به کمیته انضباطی'
  )
  WITH CHECK (
    public.current_app_role() IN ('manager', 'expert')
    AND status IN ('ارسال‌شده','دریافت توسط بازرس سازمان','در حال بررسی','سازش انجام شد','ارجاع به کمیته انضباطی','مختومه')
    AND (
      status <> 'ارجاع به کمیته انضباطی'
      OR (settlement_attempted_at IS NOT NULL AND length(trim(coalesce(settlement_note,''))) >= 5 AND committee_referred_at IS NOT NULL)
    )
    AND committee_decision IS NULL
    AND committee_decided_by IS NULL
    AND committee_decided_at IS NULL
  );

DROP POLICY IF EXISTS disciplinary_committee_read_referred ON public.line_violation_reports;
CREATE POLICY disciplinary_committee_read_referred
  ON public.line_violation_reports FOR SELECT TO authenticated
  USING (
    status = 'ارجاع به کمیته انضباطی'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.role = 'expert'
        AND p.is_active AND p.approval_status = 'approved'
        AND p.is_disciplinary_committee
    )
  );

DROP POLICY IF EXISTS disciplinary_committee_issue_verdict ON public.line_violation_reports;
CREATE POLICY disciplinary_committee_issue_verdict
  ON public.line_violation_reports FOR UPDATE TO authenticated
  USING (
    status = 'ارجاع به کمیته انضباطی'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.role = 'expert'
        AND p.is_active AND p.approval_status = 'approved'
        AND p.is_disciplinary_committee
    )
  )
  WITH CHECK (
    status = 'رأی صادر شد - در انتظار تأیید مدیر'
    AND committee_decision IS NOT NULL
    AND length(trim(committee_decision)) >= 3
    AND committee_decided_by = auth.uid()
    AND committee_decided_at IS NOT NULL
  );

CREATE INDEX IF NOT EXISTS line_violation_reports_committee_queue_idx
  ON public.line_violation_reports (status, committee_referred_at DESC);
