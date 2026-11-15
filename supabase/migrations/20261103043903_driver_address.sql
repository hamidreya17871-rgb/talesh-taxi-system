/*
# Driver address

1. Modified Tables
- `drivers`: new column `address` (text, optional) holding the driver's postal address.

2. Security
- No change to policies or grants. Existing driver and staff access rules apply to the new column.
*/

ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS address text;
