-- Restrict letter attachment metadata and uploads for disciplinary-committee experts.
-- Managers retain access. Experts who are committee-only must use the committee workflow,
-- not the general Secretariat attachment endpoint.
DROP POLICY IF EXISTS letter_attachments_staff_select ON public.letter_attachments;
CREATE POLICY letter_attachments_staff_select
  ON public.letter_attachments
  FOR SELECT TO authenticated
  USING (
    public.current_app_role() = 'manager'
    OR (
      public.current_app_role() = 'expert'
      AND NOT EXISTS (
        SELECT 1
        FROM public.profiles AS p
        WHERE p.user_id = auth.uid()
          AND COALESCE(p.is_disciplinary_committee, false)
      )
    )
  );

DROP POLICY IF EXISTS letter_attachments_staff_insert ON public.letter_attachments;
CREATE POLICY letter_attachments_staff_insert
  ON public.letter_attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.letters AS l
      WHERE l.id = letter_attachments.letter_id
    )
    AND (
      public.current_app_role() = 'manager'
      OR (
        public.current_app_role() = 'expert'
        AND NOT EXISTS (
          SELECT 1
          FROM public.profiles AS p
          WHERE p.user_id = auth.uid()
            AND COALESCE(p.is_disciplinary_committee, false)
        )
      )
    )
  );
