/*
  Per-driver read receipts for private and broadcast driver messages.
  A separate row per driver keeps broadcast-message reads independent.
*/
CREATE TABLE IF NOT EXISTS public.driver_message_reads (
  message_id uuid NOT NULL REFERENCES public.driver_messages(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, driver_id)
);

CREATE INDEX IF NOT EXISTS driver_message_reads_driver_idx
  ON public.driver_message_reads (driver_id, read_at DESC);

-- Treat pre-existing message history as already seen at rollout.
-- Only messages created after this migration generate new unread alerts.
INSERT INTO public.driver_message_reads (message_id, driver_id)
SELECT m.id, d.id
FROM public.driver_messages m
JOIN public.drivers d
  ON m.recipient_driver_id IS NULL OR m.recipient_driver_id = d.id
ON CONFLICT (message_id, driver_id) DO NOTHING;

ALTER TABLE public.driver_message_reads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.driver_message_reads FROM anon, PUBLIC;
GRANT SELECT, INSERT ON public.driver_message_reads TO authenticated;

DROP POLICY IF EXISTS driver_select_own_message_reads ON public.driver_message_reads;
CREATE POLICY driver_select_own_message_reads
  ON public.driver_message_reads FOR SELECT TO authenticated
  USING (driver_id = public.current_driver_id());

DROP POLICY IF EXISTS driver_insert_own_message_reads ON public.driver_message_reads;
CREATE POLICY driver_insert_own_message_reads
  ON public.driver_message_reads FOR INSERT TO authenticated
  WITH CHECK (
    driver_id = public.current_driver_id()
    AND public.current_app_role() = 'driver'
    AND EXISTS (
      SELECT 1 FROM public.driver_messages m
      WHERE m.id = message_id
        AND (m.recipient_driver_id IS NULL OR m.recipient_driver_id = driver_id)
    )
  );

-- Committee-only accounts must not inherit general staff message access.
DROP POLICY IF EXISTS staff_select_driver_messages ON public.driver_messages;
CREATE POLICY staff_select_driver_messages ON public.driver_messages
  FOR SELECT TO authenticated
  USING (
    public.current_app_role() IN ('manager', 'expert')
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.is_disciplinary_committee
    )
  );

DROP POLICY IF EXISTS driver_select_own_messages ON public.driver_messages;
CREATE POLICY driver_select_own_messages ON public.driver_messages
  FOR SELECT TO authenticated
  USING (
    public.current_app_role() = 'driver'
    AND public.current_driver_id() IS NOT NULL
    AND (recipient_driver_id IS NULL OR recipient_driver_id = public.current_driver_id())
  );

DROP POLICY IF EXISTS staff_insert_driver_messages ON public.driver_messages;
CREATE POLICY staff_insert_driver_messages ON public.driver_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_app_role() IN ('manager', 'expert')
    AND sender_id = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.is_disciplinary_committee
    )
  );

CREATE OR REPLACE FUNCTION public.get_unread_driver_message_count()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $
  SELECT count(*)
  FROM public.driver_messages m
  WHERE public.current_app_role() = 'driver'
    AND public.current_driver_id() IS NOT NULL
    AND (m.recipient_driver_id IS NULL OR m.recipient_driver_id = public.current_driver_id())
    AND NOT EXISTS (
      SELECT 1
      FROM public.driver_message_reads r
      WHERE r.message_id = m.id
        AND r.driver_id = public.current_driver_id()
    )
$;

REVOKE ALL ON FUNCTION public.get_unread_driver_message_count() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_unread_driver_message_count() TO authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'driver_messages'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_messages;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'driver_message_reads'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_message_reads;
  END IF;
END $$;
