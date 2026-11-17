-- Secure attachments for incoming and outgoing Secretariat letters.
-- Files are stored in the existing private archive-documents bucket.
CREATE TABLE IF NOT EXISTS public.letter_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  letter_id uuid NOT NULL REFERENCES public.letters(id) ON DELETE CASCADE,
  storage_path text NOT NULL UNIQUE,
  file_name text NOT NULL,
  mime_type text NOT NULL CHECK (mime_type IN ('application/pdf','image/jpeg','image/png')),
  file_size bigint NOT NULL CHECK (file_size > 0 AND file_size <= 10485760),
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS letter_attachments_letter_id_created_at_idx
  ON public.letter_attachments(letter_id, created_at);

ALTER TABLE public.letter_attachments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.letter_attachments FROM anon, PUBLIC;
GRANT SELECT, INSERT, DELETE ON public.letter_attachments TO authenticated;

DROP POLICY IF EXISTS letter_attachments_staff_select ON public.letter_attachments;
CREATE POLICY letter_attachments_staff_select ON public.letter_attachments
  FOR SELECT TO authenticated
  USING (public.current_app_role() IN ('manager','expert'));

DROP POLICY IF EXISTS letter_attachments_staff_insert ON public.letter_attachments;
CREATE POLICY letter_attachments_staff_insert ON public.letter_attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_app_role() IN ('manager','expert')
    AND created_by = auth.uid()
    AND EXISTS (SELECT 1 FROM public.letters l WHERE l.id = letter_id)
  );

DROP POLICY IF EXISTS letter_attachments_manager_delete ON public.letter_attachments;
CREATE POLICY letter_attachments_manager_delete ON public.letter_attachments
  FOR DELETE TO authenticated
  USING (public.current_app_role() = 'manager');
