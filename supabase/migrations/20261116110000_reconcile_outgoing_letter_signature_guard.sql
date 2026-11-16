-- Reconcile the legacy Secretariat signature guard with the newer outgoing-letter workflow.
-- The feature/administrative-workflows migration owns outgoing approval via
-- expert_reviewed_* and manager_signed_* fields. Keep referral completion/RPC
-- from 20261116100000, but remove its incompatible legacy signature trigger
-- and check constraint. No existing letter or referral rows are deleted.

DROP TRIGGER IF EXISTS letters_guard_signature ON public.letters;
ALTER TABLE public.letters
  DROP CONSTRAINT IF EXISTS letters_signature_consistency;

DROP FUNCTION IF EXISTS public.guard_letter_signature();


-- Keep referral creation atomic, but do not force outgoing letters into the
-- legacy "ارجاع شده" status: their lifecycle is governed by
-- guard_outgoing_letter_workflow and its expert/manager approval states.
CREATE OR REPLACE FUNCTION public.create_letter_referral(
  p_letter_id uuid,
  p_referred_to uuid,
  p_action text,
  p_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_referral_id uuid;
  v_role text;
  v_direction text;
BEGIN
  v_role := public.current_app_role();
  IF auth.uid() IS NULL OR v_role IS NULL OR v_role NOT IN ('manager', 'expert') THEN
    RAISE EXCEPTION 'دسترسی مجاز نیست.' USING ERRCODE = '42501';
  END IF;
  IF p_action IS NULL OR p_action NOT IN ('review', 'follow-up', 'signature') THEN
    RAISE EXCEPTION 'نوع ارجاع معتبر نیست.' USING ERRCODE = '22023';
  END IF;
  IF p_note IS NOT NULL AND length(p_note) > 2000 THEN
    RAISE EXCEPTION 'توضیح ارجاع بیش از حد مجاز است.' USING ERRCODE = '22023';
  END IF;
  IF p_referred_to IS NULL OR p_referred_to = auth.uid() OR NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = p_referred_to
      AND p.role IN ('manager', 'expert')
      AND p.is_active = true
      AND p.approval_status = 'approved'
  ) THEN
    RAISE EXCEPTION 'گیرنده ارجاع فعال و تأییدشده نیست.' USING ERRCODE = '23514';
  END IF;

  SELECT l.direction
    INTO v_direction
  FROM public.letters l
  WHERE l.id = p_letter_id
    AND l.status NOT IN ('امضا شده', 'صادر شده', 'مختومه')
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'نامه پیدا نشد، مختومه است یا امکان ارجاع ندارد.' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.letter_referrals (letter_id, referred_to, action, note, created_by)
  VALUES (p_letter_id, p_referred_to, p_action, NULLIF(btrim(p_note), ''), auth.uid())
  RETURNING id INTO v_referral_id;

  IF v_direction <> 'outgoing' THEN
    UPDATE public.letters SET status = 'ارجاع شده' WHERE id = p_letter_id;
  END IF;

  RETURN v_referral_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_letter_referral(uuid, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_letter_referral(uuid, uuid, text, text) TO authenticated;
