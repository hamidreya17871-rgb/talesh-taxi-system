-- Committee-only experts are not general fleet or leave administrators.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['drivers','vehicles','licenses','documents','reminders','violations'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'staff_select_' || t, t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (
        public.current_app_role() = ''manager''
        OR (public.current_app_role() = ''expert'' AND NOT EXISTS (
          SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.is_disciplinary_committee
        ))
      )',
      'staff_select_' || t, t
    );
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'staff_insert_' || t, t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (
        public.current_app_role() = ''manager''
        OR (public.current_app_role() = ''expert'' AND NOT EXISTS (
          SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.is_disciplinary_committee
        ))
      )',
      'staff_insert_' || t, t
    );
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'staff_update_' || t, t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (
        public.current_app_role() = ''manager''
        OR (public.current_app_role() = ''expert'' AND NOT EXISTS (
          SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.is_disciplinary_committee
        ))
      ) WITH CHECK (
        public.current_app_role() = ''manager''
        OR (public.current_app_role() = ''expert'' AND NOT EXISTS (
          SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.is_disciplinary_committee
        ))
      )',
      'staff_update_' || t, t
    );
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'staff_delete_' || t, t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (
        public.current_app_role() = ''manager''
        OR (public.current_app_role() = ''expert'' AND NOT EXISTS (
          SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.is_disciplinary_committee
        ))
      )',
      'staff_delete_' || t, t
    );
  END LOOP;
END $$;

DROP POLICY IF EXISTS staff_select_leave_requests ON public.leave_requests;
CREATE POLICY staff_select_leave_requests ON public.leave_requests FOR SELECT TO authenticated
  USING (
    public.current_app_role() = 'manager'
    OR (public.current_app_role() = 'expert' AND NOT EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.is_disciplinary_committee
    ))
  );

DROP POLICY IF EXISTS staff_review_pending_leave ON public.leave_requests;
CREATE POLICY staff_review_pending_leave ON public.leave_requests FOR UPDATE TO authenticated
  USING (
    status = 'pending'
    AND (
      public.current_app_role() = 'manager'
      OR (public.current_app_role() = 'expert' AND NOT EXISTS (
        SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.is_disciplinary_committee
      ))
    )
  )
  WITH CHECK (
    status IN ('approved','rejected')
    AND reviewed_by = auth.uid()
    AND (
      public.current_app_role() = 'manager'
      OR (public.current_app_role() = 'expert' AND NOT EXISTS (
        SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.is_disciplinary_committee
      ))
    )
  );
