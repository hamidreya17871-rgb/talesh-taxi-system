/*
# Driver licence file uploads

1. New storage
- A private file bucket `driver-licenses` for licence scans (PDF, JPG or PNG, up to 5 MB).
- Files are stored in a folder named after the driver record, so each file belongs to one driver.

2. Changes to licenses
- Adds `file_path`, the location of the uploaded scan.

3. Security
- A driver can upload, view and read only the files in their own folder.
- A driver can add a licence row only for their own record, with a file attached, and only with status "در حال بررسی" (under review).
- Managers and experts can view all licence files.
- Drivers cannot change or delete their licence rows or files.

4. Notes
- Statements are safe to re-run.
*/

ALTER TABLE licenses ADD COLUMN IF NOT EXISTS file_path text;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('driver-licenses', 'driver-licenses', false, 5242880, ARRAY['application/pdf', 'image/jpeg', 'image/png'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 5242880, allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png'];

DROP POLICY IF EXISTS "driver_upload_own_license_files" ON storage.objects;
CREATE POLICY "driver_upload_own_license_files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'driver-licenses' AND (storage.foldername(name))[1] = current_driver_id()::text);

DROP POLICY IF EXISTS "driver_read_own_license_files" ON storage.objects;
CREATE POLICY "driver_read_own_license_files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'driver-licenses' AND (storage.foldername(name))[1] = current_driver_id()::text);

DROP POLICY IF EXISTS "staff_read_license_files" ON storage.objects;
CREATE POLICY "staff_read_license_files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'driver-licenses' AND current_app_role() IN ('manager', 'expert'));

DROP POLICY IF EXISTS "driver_insert_own_license" ON licenses;
CREATE POLICY "driver_insert_own_license" ON licenses FOR INSERT TO authenticated
  WITH CHECK (driver_id = current_driver_id() AND file_path IS NOT NULL AND status = 'در حال بررسی');
