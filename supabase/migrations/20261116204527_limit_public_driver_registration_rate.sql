create table if not exists private.driver_registration_rate_limits (
  phone text not null,
  ip_hash text not null,
  window_started_at timestamptz not null default now(),
  attempts integer not null default 0,
  primary key (phone, ip_hash),
  constraint driver_registration_attempts_nonnegative check (attempts >= 0)
);

alter table private.driver_registration_rate_limits enable row level security;
revoke all on table private.driver_registration_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on table private.driver_registration_rate_limits to service_role;

create or replace function private.allow_driver_registration(p_phone text, p_ip_hash text)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, private
as $$
declare
  v_attempts integer;
begin
  delete from private.driver_registration_rate_limits
  where window_started_at < now() - interval '24 hours';

  insert into private.driver_registration_rate_limits (phone, ip_hash, window_started_at, attempts)
  values (p_phone, p_ip_hash, now(), 1)
  on conflict (phone, ip_hash) do update
    set attempts = case
      when private.driver_registration_rate_limits.window_started_at < now() - interval '1 hour' then 1
      else private.driver_registration_rate_limits.attempts + 1
    end,
    window_started_at = case
      when private.driver_registration_rate_limits.window_started_at < now() - interval '1 hour' then now()
      else private.driver_registration_rate_limits.window_started_at
    end
  returning attempts into v_attempts;

  return v_attempts <= 5;
end;
$$;

revoke all on function private.allow_driver_registration(text, text) from public, anon, authenticated;
grant execute on function private.allow_driver_registration(text, text) to service_role;
