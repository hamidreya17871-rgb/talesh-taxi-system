/*
  Enforce a single active system administrator and provide a one-time,
  authenticated promotion path for the existing organization manager.
  The Edge Function calls the RPC with the verified caller ID using service_role.
*/
CREATE UNIQUE INDEX IF NOT EXISTS profiles_single_active_system_admin_idx
  ON public.profiles (role)
  WHERE role = 'admin'
    AND is_active = true
    AND approval_status = 'approved';

CREATE OR REPLACE FUNCTION public.claim_initial_system_admin(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('talesh-single-system-admin'));

  SELECT role
    INTO v_role
    FROM public.profiles
   WHERE user_id = p_user_id
     AND is_active = true
     AND approval_status = 'approved'
   FOR UPDATE;

  IF NOT FOUND OR v_role <> 'manager' THEN
    RAISE EXCEPTION 'manager_required';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.profiles
     WHERE role = 'admin'
       AND is_active = true
       AND approval_status = 'approved'
  ) THEN
    RAISE EXCEPTION 'already_exists';
  END IF;

  UPDATE public.profiles
     SET role = 'admin'
   WHERE user_id = p_user_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_initial_system_admin(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_initial_system_admin(uuid) TO service_role;
