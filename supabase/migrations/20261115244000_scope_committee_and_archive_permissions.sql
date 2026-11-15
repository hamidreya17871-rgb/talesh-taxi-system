/*
  Least-privilege separation for disciplinary committee accounts.
  Committee experts are limited to committee files/cases and cannot operate the general secretariat.
*/
-- Citizen reports belong to the organization inspection team, not committee-only accounts.
DROP POLICY IF EXISTS staff_read_citizen_violation_reports ON public.citizen_violation_reports;
CREATE POLICY staff_read_citizen_violation_reports
  ON public.citizen_violation_reports FOR SELECT TO authenticated
  USING (
    public.current_app_role() = 'manager'
    OR (
      public.current_app_role() = 'expert'
      AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.is_disciplinary_committee)
    )
  );

DROP POLICY IF EXISTS staff_update_citizen_violation_reports ON public.citizen_violation_reports;
CREATE POLICY staff_update_citizen_violation_reports
  ON public.citizen_violation_reports FOR UPDATE TO authenticated
  USING (
    public.current_app_role() = 'manager'
    OR (
      public.current_app_role() = 'expert'
      AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.is_disciplinary_committee)
    )
  )
  WITH CHECK (
    public.current_app_role() = 'manager'
    OR (
      public.current_app_role() = 'expert'
      AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.is_disciplinary_committee)
    )
  );

-- General letters and referrals are not part of the committee-only workspace.
DROP POLICY IF EXISTS staff_select_letters ON public.letters;
CREATE POLICY staff_select_letters ON public.letters FOR SELECT TO authenticated
  USING (
    public.current_app_role() = 'manager'
    OR (public.current_app_role() = 'expert'
        AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.is_disciplinary_committee))
  );

DROP POLICY IF EXISTS staff_insert_letters ON public.letters;
CREATE POLICY staff_insert_letters ON public.letters FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      public.current_app_role() = 'manager'
      OR (public.current_app_role() = 'expert'
          AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.is_disciplinary_committee))
    )
  );

DROP POLICY IF EXISTS staff_update_letters ON public.letters;
CREATE POLICY staff_update_letters ON public.letters FOR UPDATE TO authenticated
  USING (
    public.current_app_role() = 'manager'
    OR (public.current_app_role() = 'expert'
        AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.is_disciplinary_committee))
  )
  WITH CHECK (
    public.current_app_role() = 'manager'
    OR (public.current_app_role() = 'expert'
        AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.is_disciplinary_committee))
  );

DROP POLICY IF EXISTS staff_select_letter_referrals ON public.letter_referrals;
CREATE POLICY staff_select_letter_referrals ON public.letter_referrals FOR SELECT TO authenticated
  USING (
    public.current_app_role() = 'manager'
    OR (public.current_app_role() = 'expert'
        AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.is_disciplinary_committee))
  );

DROP POLICY IF EXISTS staff_insert_letter_referrals ON public.letter_referrals;
CREATE POLICY staff_insert_letter_referrals ON public.letter_referrals FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND public.is_active_staff_user(referred_to)
    AND (
      public.current_app_role() = 'manager'
      OR (public.current_app_role() = 'expert'
          AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.is_disciplinary_committee))
    )
  );

-- Audit log access follows the record's business scope.
DROP POLICY IF EXISTS staff_read_letter_audit_log ON public.letter_audit_log;
CREATE POLICY staff_read_letter_audit_log ON public.letter_audit_log FOR SELECT TO authenticated
  USING (
    public.current_app_role() = 'manager'
    OR (public.current_app_role() = 'expert'
        AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.is_disciplinary_committee))
  );

DROP POLICY IF EXISTS staff_read_archive_audit_log ON public.archive_document_audit_log;
CREATE POLICY staff_read_archive_audit_log ON public.archive_document_audit_log FOR SELECT TO authenticated
  USING (
    public.current_app_role() = 'manager'
    OR (
      public.current_app_role() = 'expert'
      AND (
        NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.is_disciplinary_committee)
        OR EXISTS (
          SELECT 1 FROM public.archive_documents d
          WHERE d.id = document_id AND d.category = 'committee'
        )
      )
    )
  );

-- Committee experts may access only documents in the committee archive.
DROP POLICY IF EXISTS staff_select_archive_documents ON public.archive_documents;
CREATE POLICY staff_select_archive_documents ON public.archive_documents FOR SELECT TO authenticated
  USING (
    public.current_app_role() = 'manager'
    OR (
      public.current_app_role() = 'expert'
      AND (
        NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.is_disciplinary_committee)
        OR category = 'committee'
      )
    )
  );

DROP POLICY IF EXISTS staff_insert_archive_documents ON public.archive_documents;
CREATE POLICY staff_insert_archive_documents ON public.archive_documents FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND (
      public.current_app_role() = 'manager'
      OR (
        public.current_app_role() = 'expert'
        AND (
          NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.is_disciplinary_committee)
          OR category = 'committee'
        )
      )
    )
  );

REVOKE UPDATE ON public.archive_documents FROM authenticated;
GRANT UPDATE (archived_at, archived_by) ON public.archive_documents TO authenticated;
DROP POLICY IF EXISTS staff_archive_archive_documents ON public.archive_documents;
CREATE POLICY staff_archive_archive_documents ON public.archive_documents FOR UPDATE TO authenticated
  USING (
    public.current_app_role() = 'manager'
    OR (
      public.current_app_role() = 'expert'
      AND (
        NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.is_disciplinary_committee)
        OR category = 'committee'
      )
    )
  )
  WITH CHECK (
    archived_at IS NOT NULL
    AND archived_by = auth.uid()
    AND (
      public.current_app_role() = 'manager'
      OR (
        public.current_app_role() = 'expert'
        AND (
          NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.is_disciplinary_committee)
          OR category = 'committee'
        )
      )
    )
  );

-- Storage paths are prefixed by archive category. Physical deletion is disabled; use archival.
DROP POLICY IF EXISTS staff_read_archive_files ON storage.objects;
CREATE POLICY staff_read_archive_files ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'archive-documents'
    AND (
      public.current_app_role() = 'manager'
      OR (
        public.current_app_role() = 'expert'
        AND (
          NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.is_disciplinary_committee)
          OR (storage.foldername(name))[1] = 'committee'
        )
      )
    )
  );

DROP POLICY IF EXISTS staff_upload_archive_files ON storage.objects;
CREATE POLICY staff_upload_archive_files ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'archive-documents'
    AND (
      public.current_app_role() = 'manager'
      OR (
        public.current_app_role() = 'expert'
        AND (
          NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.is_disciplinary_committee)
          OR (storage.foldername(name))[1] = 'committee'
        )
      )
    )
  );

DROP POLICY IF EXISTS staff_delete_archive_files ON storage.objects;
