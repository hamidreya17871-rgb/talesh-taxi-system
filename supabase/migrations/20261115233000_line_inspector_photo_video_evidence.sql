/*
  Private photo/video evidence for line-inspector violation reports.
  Evidence is linked to a report and readable only by its reporter and authorized staff.
*/
CREATE TABLE IF NOT EXISTS public.line_violation_report_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.line_violation_reports(id) ON DELETE CASCADE,
  file_path text NOT NULL UNIQUE,
  file_name text NOT NULL CHECK (char_length(file_name) BETWEEN 1 AND 255),
  mime_type text NOT NULL CHECK (mime_type IN ('image/jpeg','image/png','image/webp','video/mp4','video/webm','video/quicktime')),
  file_size bigint NOT NULL CHECK (file_size > 0 AND file_size <= 41943040),
  uploaded_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS line_violation_report_evidence_report_idx
  ON public.line_violation_report_evidence(report_id, created_at);

ALTER TABLE public.line_violation_report_evidence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.line_violation_report_evidence FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.line_violation_report_evidence TO authenticated;

DROP POLICY IF EXISTS report_evidence_read_authorized ON public.line_violation_report_evidence;
CREATE POLICY report_evidence_read_authorized
  ON public.line_violation_report_evidence FOR SELECT TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.line_violation_reports r
      WHERE r.id = report_id
        AND (
          r.reporter_user_id = auth.uid()
          OR public.current_app_role() IN ('manager','expert')
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

DROP POLICY IF EXISTS report_evidence_insert_own ON public.line_violation_report_evidence;
CREATE POLICY report_evidence_insert_own
  ON public.line_violation_report_evidence FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.line_violation_reports r
      JOIN public.profiles p ON p.user_id = auth.uid()
      WHERE r.id = report_id
        AND r.reporter_user_id = auth.uid()
        AND p.role = 'driver' AND p.is_active
        AND p.approval_status = 'approved' AND p.is_line_inspector
        AND r.status = 'ارسال‌شده'
    )
  );

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'line-report-evidence',
  'line-report-evidence',
  false,
  41943040,
  ARRAY['image/jpeg','image/png','image/webp','video/mp4','video/webm','video/quicktime']
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = 41943040,
    allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','video/mp4','video/webm','video/quicktime'];

DROP POLICY IF EXISTS line_report_evidence_upload ON storage.objects;
CREATE POLICY line_report_evidence_upload
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'line-report-evidence'
    AND EXISTS (
      SELECT 1 FROM public.line_violation_reports r
      JOIN public.profiles p ON p.user_id = auth.uid()
      WHERE r.id::text = (storage.foldername(name))[1]
        AND r.reporter_user_id = auth.uid()
        AND r.status = 'ارسال‌شده'
        AND p.role = 'driver' AND p.is_active
        AND p.approval_status = 'approved' AND p.is_line_inspector
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
          r.reporter_user_id = auth.uid()
          OR public.current_app_role() IN ('manager','expert')
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

DROP POLICY IF EXISTS line_report_evidence_delete ON storage.objects;
CREATE POLICY line_report_evidence_delete
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'line-report-evidence'
    AND EXISTS (
      SELECT 1 FROM public.line_violation_reports r
      WHERE r.id::text = (storage.foldername(name))[1]
        AND r.reporter_user_id = auth.uid()
        AND r.status = 'ارسال‌شده'
    )
  );
