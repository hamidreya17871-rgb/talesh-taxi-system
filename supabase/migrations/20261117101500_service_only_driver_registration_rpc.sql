create or replace function public.allow_driver_registration(p_phone text, p_ip_hash text)
returns boolean
language sql
security definer
set search_path = pg_catalog, public, private
as $$
  select private.allow_driver_registration(p_phone, p_ip_hash);
$$;
revoke all on function public.allow_driver_registration(text, text) from public, anon, authenticated;
grant execute on function public.allow_driver_registration(text, text) to service_role;

create or replace function public.store_driver_activation_token(
  p_user_id uuid,
  p_code_hash text,
  p_expires_at timestamptz
)
returns void
language sql
security definer
set search_path = pg_catalog, public, private
as $$
  insert into private.driver_activation_tokens (user_id, code_hash, expires_at)
  values (p_user_id, p_code_hash, p_expires_at);
$$;
revoke all on function public.store_driver_activation_token(uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.store_driver_activation_token(uuid, text, timestamptz) to service_role;

create or replace function public.consume_driver_activation_token(p_user_id uuid, p_code_hash text)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_consumed uuid;
begin
  delete from private.driver_activation_tokens
  where user_id = p_user_id
    and code_hash = p_code_hash
    and expires_at > now()
  returning user_id into v_consumed;
  return v_consumed is not null;
end;
$$;
revoke all on function public.consume_driver_activation_token(uuid, text) from public, anon, authenticated;
grant execute on function public.consume_driver_activation_token(uuid, text) to service_role;
