/*
# Link registered vehicles to their driver

1. Modified Tables
- `vehicles`: new `driver_id` column that links a vehicle to the driver record it was registered with. Existing vehicles stay unlinked. If a driver record is deleted, the link is cleared and the vehicle is kept.

2. Security
- No policy changes. The column is read through the existing staff policies.

3. Notes
- Statements are idempotent and safe to re-run.
*/

ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS driver_id uuid REFERENCES drivers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS vehicles_driver_id_idx ON vehicles (driver_id);
