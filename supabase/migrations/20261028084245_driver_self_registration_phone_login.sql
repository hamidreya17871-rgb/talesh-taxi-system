/*
# Driver self-registration with phone login and approval

1. Modified Tables
- `profiles`: new `phone` column (the Iranian mobile number used to sign in, unique when present) and `approval_status` ('pending', 'approved' or 'rejected'). Existing accounts are marked approved.
- `vehicles`: new `taxi_row_no` column for the taxi row number (ردیف تاکسی).

2. Security
- The server function (service role) needs to insert and update drivers and vehicles when a driver registers or staff approve a registration. Grants are added for that role only.
- No client-side policy changes. Pending accounts have is_active = false, so the role helper functions return nothing for them and they cannot read fleet data.

3. Notes
- Statements are idempotent and safe to re-run.
*/

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'approved';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_approval_status_check'
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_approval_status_check
      CHECK (approval_status IN ('pending', 'approved', 'rejected'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_key ON profiles (phone) WHERE phone IS NOT NULL;

ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS taxi_row_no text;

GRANT SELECT, INSERT, UPDATE ON drivers, vehicles TO service_role;
