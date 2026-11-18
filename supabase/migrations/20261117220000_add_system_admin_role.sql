/*
  Add a separate system administrator role.
  Administrators receive manager-equivalent RLS access while their distinct role
  remains visible to the application and is enforced by manage-staff.
*/
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'manager', 'expert', 'driver'));

CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE WHEN p.role = 'admin' THEN 'manager' ELSE p.role END
  FROM public.profiles AS p
  WHERE p.user_id = auth.uid()
    AND p.is_active
    AND p.approval_status = 'approved'
$$;

REVOKE EXECUTE ON FUNCTION public.current_app_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_app_role() TO authenticated;
