alter table public.profiles
  add column if not exists driver_activation_code_hash text,
  add column if not exists driver_activation_expires_at timestamptz;

comment on column public.profiles.driver_activation_code_hash is
  'SHA-256 hash of the one-time activation key issued for bulk-imported driver accounts. Never expose this value to clients.';
comment on column public.profiles.driver_activation_expires_at is
  'Expiry timestamp for a one-time driver account activation key.';
