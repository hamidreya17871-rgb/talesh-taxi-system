/*
# Secretariat letters and referrals

Creates the two tables used by the Secretariat screen when they are not already
present. Access is limited to authenticated managers and experts. Deleting a
letter cascades to its referrals; deleting a referred staff profile removes its
referrals as well.
*/

CREATE TABLE IF NOT EXISTS public.letters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  letter_no bigint GENERATED ALWAYS AS IDENTITY,
  direction text NOT NULL CHECK (direction IN ('incoming', 'outgoing')),
  subject text NOT NULL,
  body text NOT NULL DEFAULT '',
  correspondent text,
  letter_date date,
  attachment_path text,
  status text NOT NULL DEFAULT 'ثبت شده',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.letters
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid();

CREATE TABLE IF NOT EXISTS public.letter_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  letter_id uuid NOT NULL REFERENCES public.letters(id) ON DELETE CASCADE,
  referred_to uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('review', 'follow-up', 'signature')),
  note text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done')),
  created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.letter_referrals
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid();

CREATE INDEX IF NOT EXISTS letters_created_at_idx ON public.letters (created_at DESC);
CREATE INDEX IF NOT EXISTS letter_referrals_letter_id_idx ON public.letter_referrals (letter_id);
CREATE INDEX IF NOT EXISTS letter_referrals_referred_to_idx ON public.letter_referrals (referred_to);

ALTER TABLE public.letters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.letter_referrals ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  policy_row record;
BEGIN
  FOR policy_row IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('letters', 'letter_referrals')
      AND ( 'anon' = ANY(roles) OR 'public' = ANY(roles) )
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', policy_row.policyname, policy_row.tablename);
  END LOOP;
END $$;

REVOKE ALL ON TABLE public.letters, public.letter_referrals FROM anon, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.letters TO authenticated;
GRANT SELECT, INSERT ON public.letter_referrals TO authenticated;

CREATE OR REPLACE FUNCTION public.is_active_staff_user(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles AS p
    WHERE p.user_id = p_user_id
      AND p.role IN ('manager', 'expert')
      AND p.is_active
      AND p.approval_status = 'approved'
  )
$$;

REVOKE EXECUTE ON FUNCTION public.is_active_staff_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_active_staff_user(uuid) TO authenticated;

DROP POLICY IF EXISTS staff_select_letters ON public.letters;
CREATE POLICY staff_select_letters ON public.letters
  FOR SELECT TO authenticated
  USING (public.current_app_role() IN ('manager', 'expert'));

DROP POLICY IF EXISTS staff_insert_letters ON public.letters;
CREATE POLICY staff_insert_letters ON public.letters
  FOR INSERT TO authenticated
  WITH CHECK (public.current_app_role() IN ('manager', 'expert') AND created_by = auth.uid());

DROP POLICY IF EXISTS staff_update_letters ON public.letters;
CREATE POLICY staff_update_letters ON public.letters
  FOR UPDATE TO authenticated
  USING (public.current_app_role() IN ('manager', 'expert'))
  WITH CHECK (public.current_app_role() IN ('manager', 'expert'));

DROP POLICY IF EXISTS manager_delete_letters ON public.letters;
CREATE POLICY manager_delete_letters ON public.letters
  FOR DELETE TO authenticated
  USING (public.current_app_role() = 'manager');

DROP POLICY IF EXISTS staff_select_letter_referrals ON public.letter_referrals;
CREATE POLICY staff_select_letter_referrals ON public.letter_referrals
  FOR SELECT TO authenticated
  USING (public.current_app_role() IN ('manager', 'expert'));

DROP POLICY IF EXISTS staff_insert_letter_referrals ON public.letter_referrals;
CREATE POLICY staff_insert_letter_referrals ON public.letter_referrals
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_app_role() IN ('manager', 'expert')
    AND created_by = auth.uid()
    AND public.is_active_staff_user(referred_to)
  );
