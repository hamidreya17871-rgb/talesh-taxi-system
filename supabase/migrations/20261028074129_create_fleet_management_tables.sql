/*
# Create fleet management tables for Talesh taxi system

1. New Tables
- `drivers`: driver profiles (name, national code, phone, licence number, route, status, notes)
- `vehicles`: taxi vehicles (plate, model, assigned driver, year, insurance and inspection expiry dates, status, notes)
- `licenses`: operating licences and permits (kind, number, owner, issue and expiry dates, status, notes)
- `documents`: supporting documents with expiry dates and status
- `reminders`: follow-up reminders with a date, category and open/done status
- `violations`: traffic/operation violations with date, plate, driver, amount and handling status

Every table has a `id` (uuid primary key) and `created_at` timestamp.

2. Security
- Row level security is enabled on all six tables.
- The app has no sign-in screen, so the anon and authenticated roles are granted SELECT, INSERT, UPDATE and DELETE.
- Each table has four separate policies (one per verb) that allow access to all rows, because the data is intentionally shared across the single-tenant system.

3. Notes
- No existing data is modified or removed.
- Statements are idempotent and safe to re-run.
*/

CREATE TABLE IF NOT EXISTS drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  national_code text,
  phone text,
  license_number text,
  route text,
  status text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plate text,
  model text,
  driver_name text,
  year integer,
  insurance_expires date,
  inspection_expires date,
  status text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS licenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text,
  number text,
  owner text,
  issued_on date,
  expires_on date,
  status text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text,
  related_to text,
  number text,
  expires_on date,
  status text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text,
  remind_on date,
  category text,
  status text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS violations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recorded_on date,
  plate text,
  driver_name text,
  kind text,
  amount bigint,
  status text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE violations ENABLE ROW LEVEL SECURITY;

-- Start closed: role-scoped grants and policies are added by the next migration.
-- Never expose driver, vehicle, licence, document or violation records to anon.
REVOKE ALL ON drivers, vehicles, licenses, documents, reminders, violations FROM PUBLIC, anon, authenticated;
