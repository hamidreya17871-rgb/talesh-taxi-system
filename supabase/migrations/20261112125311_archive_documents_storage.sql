/*
# Document archive

1. New table `archive_documents`
- One row per archived document (scanned PDF, JPG or PNG).
- `category`: driver, vehicle, inspection, committee or other.
- `driver_id` is set only for driver documents; `vehicle_id` only for vehicle documents. Other categories have neither.
- `title`, `file_path` (location in storage), `file_name`, `mime_type`, `uploaded_by`, `created_at`.

2. New private storage bucket `archive-documents`
- Up to 10 MB per file; PDF, JPG or PNG only.

3. Security
- Row level security is enabled on the table.
- Only managers and experts can view, add and delete archive documents. Drivers have no access.
- Grants are limited to the verbs used: select, insert and delete. Documents are not edited in place.
- Storage access for the bucket is limited to managers and experts for read, upload and delete.

4. Notes
- Statements are safe to re-run.
*/

CREATE TABLE IF NOT EXISTS public.archive_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL CHECK (category IN ('driver', 'vehicle', 'inspection', 'committee', 'other')),
  driver_id uuid REFERENCES public.drivers(id) ON DELETE CASCADE,
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  file_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  uploaded_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (category <> 'driver' OR driver_id IS NOT NULL),
  CHECK (category <> 'vehicle' OR vehicle_id IS NOT NULL),
  CHECK (driver_id IS NULL OR category = 'driver'),
  CHECK (vehicle_id IS NULL OR category = 'vehicle')
);

CREATE INDEX IF NOT EXISTS archive_documents_driver_id_idx ON public.archive_documents (driver_id);
CREATE INDEX IF NOT EXISTS archive_documents_vehicle_id_idx ON public.archive_documents (vehicle_id);

ALTER TABLE public.archive_documents ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, DELETE ON public.archive_documents TO authenticated;

DROP POLICY IF EXISTS staff_select_archive_documents ON public.archive_documents;
CREATE POLICY staff_select_archive_documents ON public.archive_documents
  FOR SELECT TO authenticated
  USING (public.current_app_role() IN ('manager', 'expert'));

DROP POLICY IF EXISTS staff_insert_archive_documents ON public.archive_documents;
CREATE POLICY staff_insert_archive_documents ON public.archive_documents
  FOR INSERT TO authenticated
  WITH CHECK (public.current_app_role() IN ('manager', 'expert') AND uploaded_by = auth.uid());

DROP POLICY IF EXISTS staff_delete_archive_documents ON public.archive_documents;
CREATE POLICY staff_delete_archive_documents ON public.archive_documents
  FOR DELETE TO authenticated
  USING (public.current_app_role() IN ('manager', 'expert'));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('archive-documents', 'archive-documents', false, 10485760, ARRAY['application/pdf', 'image/jpeg', 'image/png'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 10485760, allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png'];

DROP POLICY IF EXISTS staff_read_archive_files ON storage.objects;
CREATE POLICY staff_read_archive_files ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'archive-documents' AND public.current_app_role() IN ('manager', 'expert'));

DROP POLICY IF EXISTS staff_upload_archive_files ON storage.objects;
CREATE POLICY staff_upload_archive_files ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'archive-documents' AND public.current_app_role() IN ('manager', 'expert'));

DROP POLICY IF EXISTS staff_delete_archive_files ON storage.objects;
CREATE POLICY staff_delete_archive_files ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'archive-documents' AND public.current_app_role() IN ('manager', 'expert'));
