CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO ''
AS $$
  SELECT p.role FROM public.profiles AS p
  WHERE p.user_id = auth.uid() AND p.is_active AND p.approval_status = 'approved'
$$;

CREATE OR REPLACE FUNCTION public.current_driver_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO ''
AS $$
  SELECT p.driver_id FROM public.profiles AS p
  WHERE p.user_id = auth.uid() AND p.is_active AND p.approval_status = 'approved' AND p.role = 'driver'
$$;
