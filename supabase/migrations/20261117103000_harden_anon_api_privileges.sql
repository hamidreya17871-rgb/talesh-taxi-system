-- Tighten public API table grants without breaking the anonymous citizen report form.
-- The form is intentionally allowed to insert only its six user-supplied fields.
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon;
GRANT INSERT (full_name, phone, violation_type, taxi_identifier, location, description)
  ON TABLE public.citizen_violation_reports TO anon;

-- Authenticated application users keep the CRUD grants defined by each table migration,
-- but must not receive DDL-level privileges on application tables.
REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN
  ON ALL TABLES IN SCHEMA public FROM authenticated;

-- Prevent future postgres-owned public tables from inheriting these broad defaults.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLES FROM authenticated;

-- Supabase may create public objects as supabase_admin; harden that creator's defaults too.
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
  REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN ON TABLES FROM authenticated;

-- The rate-limit helper is used only by the RLS policy. Keep it outside the
-- PostgREST-exposed public schema so anonymous clients cannot probe phone limits via RPC.
CREATE SCHEMA IF NOT EXISTS private;
CREATE OR REPLACE FUNCTION private.can_submit_citizen_violation_report(p_phone text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT
    count(*) FILTER (WHERE r.created_at >= now() - interval '1 hour') < 3
    AND count(*) FILTER (WHERE r.created_at >= now() - interval '24 hours') < 10
  FROM public.citizen_violation_reports AS r
  WHERE r.phone = p_phone
$function$;

REVOKE ALL ON FUNCTION private.can_submit_citizen_violation_report(text)
  FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO anon;
GRANT EXECUTE ON FUNCTION private.can_submit_citizen_violation_report(text) TO anon;

DROP POLICY IF EXISTS citizen_submit_violation_report ON public.citizen_violation_reports;
CREATE POLICY citizen_submit_violation_report
  ON public.citizen_violation_reports
  FOR INSERT TO anon
  WITH CHECK (
    status = 'دریافت‌شده'
    AND reviewed_at IS NULL
    AND reviewed_by IS NULL
    AND staff_note IS NULL
    AND private.can_submit_citizen_violation_report(phone)
  );

DROP FUNCTION public.can_submit_citizen_violation_report(text);


-- The active-staff predicate accepts an arbitrary user UUID and is only an
-- internal RLS helper. Move it out of the PostgREST-exposed public schema.
CREATE OR REPLACE FUNCTION private.is_active_staff_user(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles AS p
    WHERE p.user_id = p_user_id
      AND p.role IN ('manager', 'expert')
      AND p.is_active
      AND p.approval_status = 'approved'
  )
$function$;

REVOKE ALL ON FUNCTION private.is_active_staff_user(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_active_staff_user(uuid) TO authenticated;

-- Preserve the current committee restriction while switching the helper.
DROP POLICY IF EXISTS staff_insert_letter_referrals ON public.letter_referrals;
CREATE POLICY staff_insert_letter_referrals
  ON public.letter_referrals
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND private.is_active_staff_user(referred_to)
    AND (
      public.current_app_role() = 'manager'
      OR (
        public.current_app_role() = 'expert'
        AND NOT EXISTS (
          SELECT 1
          FROM public.profiles AS p
          WHERE p.user_id = auth.uid()
            AND p.is_disciplinary_committee
        )
      )
    )
  );

REVOKE ALL ON FUNCTION public.is_active_staff_user(uuid)
  FROM PUBLIC, anon, authenticated;
DROP FUNCTION public.is_active_staff_user(uuid);
