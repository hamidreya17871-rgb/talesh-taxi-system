/*
# Let drivers read their own vehicle and violations

1. Security
- Drivers can read the vehicle linked to their driver record (vehicles.driver_id = their driver record).
- Drivers can read violations recorded against a plate that belongs to their own vehicle.
- Drivers still cannot insert, change or delete any fleet record.

2. Notes
- Policies are dropped and recreated so the statements are safe to re-run.
*/

DROP POLICY IF EXISTS "driver_select_own_vehicle" ON vehicles;
CREATE POLICY "driver_select_own_vehicle" ON vehicles FOR SELECT TO authenticated
  USING (driver_id = current_driver_id());

DROP POLICY IF EXISTS "driver_select_own_violations" ON violations;
CREATE POLICY "driver_select_own_violations" ON violations FOR SELECT TO authenticated
  USING (
    plate IN (SELECT v.plate FROM vehicles AS v WHERE v.driver_id = current_driver_id())
  );
