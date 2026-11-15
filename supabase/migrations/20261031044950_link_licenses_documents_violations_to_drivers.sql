/*
# Link licenses, documents and violations to drivers

1. Changes
- Adds an optional `driver_id` to `licenses`, `documents` and `violations`, pointing at the driver record.
- Existing rows are linked automatically when their name matches exactly one driver.

2. Security
- Drivers can read only the licenses, documents and violations linked to their own driver record.
- Drivers cannot insert, update or delete these rows.
- The earlier plate-based violations policy is replaced by the driver link.

3. Notes
- Statements are safe to re-run.
*/

ALTER TABLE licenses ADD COLUMN IF NOT EXISTS driver_id uuid REFERENCES drivers(id) ON DELETE SET NULL;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS driver_id uuid REFERENCES drivers(id) ON DELETE SET NULL;
ALTER TABLE violations ADD COLUMN IF NOT EXISTS driver_id uuid REFERENCES drivers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS licenses_driver_id_idx ON licenses (driver_id);
CREATE INDEX IF NOT EXISTS documents_driver_id_idx ON documents (driver_id);
CREATE INDEX IF NOT EXISTS violations_driver_id_idx ON violations (driver_id);

UPDATE licenses l SET driver_id = d.id
FROM drivers d
WHERE l.driver_id IS NULL AND d.name = l.owner
  AND (SELECT count(*) FROM drivers d2 WHERE d2.name = l.owner) = 1;

UPDATE documents doc SET driver_id = d.id
FROM drivers d
WHERE doc.driver_id IS NULL AND d.name = doc.related_to
  AND (SELECT count(*) FROM drivers d2 WHERE d2.name = doc.related_to) = 1;

UPDATE violations v SET driver_id = d.id
FROM drivers d
WHERE v.driver_id IS NULL AND d.name = v.driver_name
  AND (SELECT count(*) FROM drivers d2 WHERE d2.name = v.driver_name) = 1;

DROP POLICY IF EXISTS "driver_select_own_violations" ON violations;
CREATE POLICY "driver_select_own_violations" ON violations FOR SELECT TO authenticated
  USING (driver_id = current_driver_id());

DROP POLICY IF EXISTS "driver_select_own_licenses" ON licenses;
CREATE POLICY "driver_select_own_licenses" ON licenses FOR SELECT TO authenticated
  USING (driver_id = current_driver_id());

DROP POLICY IF EXISTS "driver_select_own_documents" ON documents;
CREATE POLICY "driver_select_own_documents" ON documents FOR SELECT TO authenticated
  USING (driver_id = current_driver_id());
