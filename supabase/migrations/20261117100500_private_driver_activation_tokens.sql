create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

create table if not exists private.driver_activation_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table private.driver_activation_tokens enable row level security;
revoke all on table private.driver_activation_tokens from public, anon, authenticated;
grant select, insert, update, delete on table private.driver_activation_tokens to service_role;
