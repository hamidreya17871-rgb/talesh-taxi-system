/*
# Security hardening for fleet records

The original bootstrap migration allowed anonymous access to every fleet table.
Remove those permissive policies and revoke anon table privileges. Authenticated
role-specific policies introduced by later migrations remain in force.
*/
DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['drivers','vehicles','licenses','documents','reminders','violations']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'anon_select_' || table_name, table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'anon_insert_' || table_name, table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'anon_update_' || table_name, table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'anon_delete_' || table_name, table_name);
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM anon', table_name);
  END LOOP;
END $$;

-- Keep the authenticated application grants required by the role-scoped RLS policies.
GRANT SELECT, INSERT, UPDATE, DELETE
ON public.drivers, public.vehicles, public.licenses, public.documents, public.reminders, public.violations
TO authenticated;
