/*
# Let drivers edit their own licence while it awaits expert review

1. Modified Tables
- `licenses`: drivers can now update a licence record that is linked to them, but only while its status is still 'در حال بررسی' (awaiting review).

2. Security
- New UPDATE policy for drivers: the row must belong to the signed-in driver, and both the existing and the new row must keep status 'در حال بررسی' and keep a file attached.
- Drivers therefore cannot approve their own licence or move it to another driver.
- Managers and experts keep their existing update access, so they can confirm and edit licences at any time.
- The table-level UPDATE grant for authenticated already exists; it is restated here so the migration is self-contained.
*/

GRANT SELECT, INSERT, UPDATE ON licenses TO authenticated;

DROP POLICY IF EXISTS "driver_update_own_pending_license" ON licenses;
CREATE POLICY "driver_update_own_pending_license" ON licenses
  FOR UPDATE
  TO authenticated
  USING (driver_id = current_driver_id() AND status = 'در حال بررسی')
  WITH CHECK (driver_id = current_driver_id() AND status = 'در حال بررسی' AND file_path IS NOT NULL);
