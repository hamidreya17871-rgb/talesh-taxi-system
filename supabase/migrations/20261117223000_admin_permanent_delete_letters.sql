-- Permit the system administrator to permanently remove archived letters as well.
CREATE OR REPLACE FUNCTION public.permanently_delete_archived_letter(p_letter_id uuid, p_actor_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := p_actor_id;
  v_letter public.letters%ROWTYPE;
  v_role text;
  v_paths text[];
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'دسترسی مجاز نیست.' USING ERRCODE = '42501';
  END IF;

  SELECT p.role INTO v_role
  FROM public.profiles p
  WHERE p.user_id = v_actor
    AND p.is_active = true
    AND p.approval_status = 'approved';

  IF v_role IS NULL OR v_role NOT IN ('manager', 'admin') THEN
    RAISE EXCEPTION 'حذف دائمی فقط برای مدیر سازمان مجاز است.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_letter
  FROM public.letters
  WHERE id = p_letter_id
    AND deleted_at IS NOT NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'نامه در سطل بازیافت پیدا نشد.' USING ERRCODE = 'P0002';
  END IF;

  SELECT COALESCE(array_agg(path) FILTER (WHERE path IS NOT NULL AND btrim(path) <> ''), ARRAY[]::text[])
  INTO v_paths
  FROM (
    SELECT v_letter.attachment_path AS path
    UNION ALL SELECT v_letter.delivery_receipt_path
    UNION ALL SELECT a.storage_path FROM public.letter_attachments a WHERE a.letter_id = p_letter_id
  ) AS stored_files;

  PERFORM set_config('request.jwt.claim.sub', v_actor::text, true);
  PERFORM set_config('app.allow_archived_letter_delete', 'on', true);
  DELETE FROM public.letters WHERE id = p_letter_id;

  RETURN jsonb_build_object(
    'letter_no', v_letter.letter_no,
    'subject', v_letter.subject,
    'storage_paths', to_jsonb(v_paths)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.permanently_delete_archived_letter(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.permanently_delete_archived_letter(uuid, uuid) TO service_role;
