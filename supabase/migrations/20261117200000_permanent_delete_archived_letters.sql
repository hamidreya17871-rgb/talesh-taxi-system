-- Allow only a manager to permanently remove a letter that is already in the recycle bin.
-- Workflow events and audit history are retained; attachment objects are cleaned up by the
-- manage-staff edge function after this transaction returns their storage paths.

ALTER TABLE public.letter_workflow_events
  ALTER COLUMN letter_id DROP NOT NULL;

ALTER TABLE public.letter_workflow_events
  DROP CONSTRAINT IF EXISTS letter_workflow_events_letter_id_fkey;

ALTER TABLE public.letter_workflow_events
  ADD CONSTRAINT letter_workflow_events_letter_id_fkey
  FOREIGN KEY (letter_id) REFERENCES public.letters(id) ON DELETE SET NULL;

ALTER TABLE public.letter_audit_log
  DROP CONSTRAINT IF EXISTS letter_audit_log_action_check;

ALTER TABLE public.letter_audit_log
  ADD CONSTRAINT letter_audit_log_action_check
  CHECK (action IN ('created', 'updated', 'archived', 'permanently_deleted'));

CREATE OR REPLACE FUNCTION public.prevent_admin_record_hard_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_TABLE_NAME = 'letters'
    AND OLD.deleted_at IS NOT NULL
    AND current_setting('app.allow_archived_letter_delete', true) = 'on'
    AND public.current_app_role() = 'manager'
  THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Administrative records must be archived, not deleted';
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_signed_letter_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.status = 'امضا شده'
    AND NOT (
      OLD.deleted_at IS NOT NULL
      AND current_setting('app.allow_archived_letter_delete', true) = 'on'
      AND public.current_app_role() = 'manager'
    )
  THEN
    RAISE EXCEPTION 'نامه امضا شده فقط پس از انتقال به سطل بازیافت و با دسترسی مدیر قابل حذف دائمی است.' USING ERRCODE = '42501';
  END IF;
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.write_admin_record_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_old jsonb;
  v_new jsonb;
  v_id uuid;
  v_action text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_new := to_jsonb(NEW);
    v_id := (v_new ->> 'id')::uuid;
    v_action := CASE WHEN TG_TABLE_NAME = 'letters' THEN 'created' ELSE 'uploaded' END;
  ELSIF TG_OP = 'DELETE' THEN
    v_old := to_jsonb(OLD);
    v_id := (v_old ->> 'id')::uuid;
    v_action := 'permanently_deleted';
  ELSE
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_id := (v_new ->> 'id')::uuid;
    IF TG_TABLE_NAME = 'letters' THEN
      v_action := CASE WHEN (v_old ->> 'deleted_at') IS NULL AND (v_new ->> 'deleted_at') IS NOT NULL THEN 'archived' ELSE 'updated' END;
    ELSE
      v_action := CASE WHEN (v_old ->> 'archived_at') IS NULL AND (v_new ->> 'archived_at') IS NOT NULL THEN 'archived' ELSE 'uploaded' END;
    END IF;
  END IF;

  IF TG_TABLE_NAME = 'letters' THEN
    INSERT INTO public.letter_audit_log(letter_id, actor_id, action, old_record, new_record)
    VALUES (v_id, auth.uid(), v_action, v_old, v_new);
  ELSE
    INSERT INTO public.archive_document_audit_log(document_id, actor_id, action, old_record, new_record)
    VALUES (v_id, auth.uid(), v_action, v_old, v_new);
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS letters_admin_audit ON public.letters;
CREATE TRIGGER letters_admin_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.letters
  FOR EACH ROW EXECUTE FUNCTION public.write_admin_record_audit();

DROP FUNCTION IF EXISTS public.permanently_delete_archived_letter(uuid);

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

  IF v_role IS DISTINCT FROM 'manager' THEN
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
