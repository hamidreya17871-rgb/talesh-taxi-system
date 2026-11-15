/*
# Driver messages from staff

1. New Tables
- `driver_messages`: messages sent by managers and experts to drivers.
  - `id` (uuid, primary key)
  - `sender_id` (uuid, the staff member who sent it; set to null if that account is deleted)
  - `recipient_driver_id` (uuid, the driver it is addressed to; null means it is addressed to all drivers)
  - `body` (text, 1 to 2000 characters after trimming)
  - `created_at` (timestamp)

2. Security
- Row level security is enabled.
- Managers and experts can read all messages and send new ones as themselves.
- Managers can delete messages.
- Drivers can read only messages addressed to them or to all drivers. They cannot write.
- Each command has its own policy. There is no update policy, so messages cannot be edited.
- Grants are limited to the verbs above for the authenticated role.
*/

CREATE TABLE IF NOT EXISTS public.driver_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  recipient_driver_id uuid REFERENCES public.drivers(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS driver_messages_recipient_idx ON public.driver_messages (recipient_driver_id, created_at DESC);

ALTER TABLE public.driver_messages ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, DELETE ON public.driver_messages TO authenticated;

DROP POLICY IF EXISTS staff_select_driver_messages ON public.driver_messages;
CREATE POLICY staff_select_driver_messages ON public.driver_messages
  FOR SELECT
  TO authenticated
  USING (public.current_app_role() IN ('manager', 'expert'));

DROP POLICY IF EXISTS driver_select_own_messages ON public.driver_messages;
CREATE POLICY driver_select_own_messages ON public.driver_messages
  FOR SELECT
  TO authenticated
  USING (recipient_driver_id IS NULL OR recipient_driver_id = public.current_driver_id());

DROP POLICY IF EXISTS staff_insert_driver_messages ON public.driver_messages;
CREATE POLICY staff_insert_driver_messages ON public.driver_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_app_role() IN ('manager', 'expert')
    AND sender_id = auth.uid()
  );

DROP POLICY IF EXISTS manager_delete_driver_messages ON public.driver_messages;
CREATE POLICY manager_delete_driver_messages ON public.driver_messages
  FOR DELETE
  TO authenticated
  USING (public.current_app_role() = 'manager');
