-- Keep committee evidence access scoped to committee-phase cases only.
DROP POLICY IF EXISTS report_evidence_read_authorized ON public.line_violation_report_evidence;
CREATE POLICY report_evidence_read_authorized
  ON public.line_violation_report_evidence FOR SELECT TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR EXISTS (
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
            WHERE p.user_id = auth.uid() AND p.role = 'expert'
              AND p.is_active AND p.approval_status = 'approved'
              AND p.is_disciplinary_committee
              AND r.status IN ('ارجاع به کمیته انضباطی','رأی صادر شد - در انتظار تأیید مدیر','تأیید نهایی رأی')
          )
        )
    )
  );

DROP POLICY IF EXISTS line_report_evidence_read ON storage.objects;
CREATE POLICY line_report_evidence_read
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'line-report-evidence'
    AND EXISTS (
      SELECT 1 FROM public.line_violation_reports r
      WHERE r.id::text = (storage.foldername(name))[1]
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
            WHERE p.user_id = auth.uid() AND p.role = 'expert'
              AND p.is_active AND p.approval_status = 'approved'
              AND p.is_disciplinary_committee
              AND r.status IN ('ارجاع به کمیته انضباطی','رأی صادر شد - در انتظار تأیید مدیر','تأیید نهایی رأی')
          )
        )
    )
  );
