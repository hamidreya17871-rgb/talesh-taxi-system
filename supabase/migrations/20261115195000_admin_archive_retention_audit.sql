/*
  Administrative records retention and audit trail.
  Additive only: existing letters, referrals, archive rows and storage objects are preserved.
*/
ALTER TABLE public.letters
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.archive_documents
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS letters_active_created_at_idx
  ON public.letters (created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS archive_documents_active_created_at_idx
  ON public.archive_documents (created_at DESC) WHERE archived_at IS NULL;

CREATE TABLE IF NOT EXISTS public.letter_audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  letter_id uuid,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('created', 'updated', 'archived')),
  old_record jsonb,
  new_record jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.archive_document_audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  document_id uuid,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('uploaded', 'archived')),
  old_record jsonb,
  new_record jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.letter_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.archive_document_audit_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.letter_audit_log, public.archive_document_audit_log FROM anon, PUBLIC, authenticated;
GRANT SELECT ON public.letter_audit_log, public.archive_document_audit_log TO authenticated;

DROP POLICY IF EXISTS staff_read_letter_audit_log ON public.letter_audit_log;
CREATE POLICY staff_read_letter_audit_log ON public.letter_audit_log
  FOR SELECT TO authenticated
  USING (public.current_app_role() IN ('manager', 'expert'));

DROP POLICY IF EXISTS staff_read_archive_audit_log ON public.archive_document_audit_log;
CREATE POLICY staff_read_archive_audit_log ON public.archive_document_audit_log
  FOR SELECT TO authenticated
  USING (public.current_app_role() IN ('manager', 'expert'));

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
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.write_admin_record_audit() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS letters_admin_audit ON public.letters;
CREATE TRIGGER letters_admin_audit
  AFTER INSERT OR UPDATE ON public.letters
  FOR EACH ROW EXECUTE FUNCTION public.write_admin_record_audit();

DROP TRIGGER IF EXISTS archive_documents_admin_audit ON public.archive_documents;
CREATE TRIGGER archive_documents_admin_audit
  AFTER INSERT OR UPDATE ON public.archive_documents
  FOR EACH ROW EXECUTE FUNCTION public.write_admin_record_audit();

-- Records are retained; the application now uses reversible archival instead of DELETE.
DROP POLICY IF EXISTS manager_delete_letters ON public.letters;
REVOKE DELETE ON public.letters FROM authenticated;

DROP POLICY IF EXISTS staff_delete_archive_documents ON public.archive_documents;
REVOKE DELETE ON public.archive_documents FROM authenticated;
GRANT UPDATE ON public.archive_documents TO authenticated;
DROP POLICY IF EXISTS staff_archive_archive_documents ON public.archive_documents;
CREATE POLICY staff_archive_archive_documents ON public.archive_documents
  FOR UPDATE TO authenticated
  USING (public.current_app_role() IN ('manager', 'expert'))
  WITH CHECK (public.current_app_role() IN ('manager', 'expert'));

CREATE OR REPLACE FUNCTION public.prevent_admin_record_hard_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'Administrative records must be archived, not deleted';
END;
$$;

DROP TRIGGER IF EXISTS prevent_letter_hard_delete ON public.letters;
CREATE TRIGGER prevent_letter_hard_delete
  BEFORE DELETE ON public.letters
  FOR EACH ROW EXECUTE FUNCTION public.prevent_admin_record_hard_delete();

DROP TRIGGER IF EXISTS prevent_archive_hard_delete ON public.archive_documents;
CREATE TRIGGER prevent_archive_hard_delete
  BEFORE DELETE ON public.archive_documents
  FOR EACH ROW EXECUTE FUNCTION public.prevent_admin_record_hard_delete();
