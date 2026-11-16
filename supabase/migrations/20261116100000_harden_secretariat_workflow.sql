-- Harden Secretariat referral and final-signature workflow.
-- Additive only: no existing records are deleted or rewritten.

ALTER TABLE public.letters
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS signed_by uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS signed_at timestamptz;

ALTER TABLE public.letter_referrals
  ADD COLUMN IF NOT EXISTS completed_by uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

CREATE INDEX IF NOT EXISTS letter_referrals_recipient_status_idx
  ON public.letter_referrals (referred_to, status);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'letters_signature_consistency'
      AND conrelid = 'public.letters'::regclass
  ) THEN
    ALTER TABLE public.letters
      ADD CONSTRAINT letters_signature_consistency
      CHECK (
        (status = 'امضا شده' AND signed_by IS NOT NULL AND signed_at IS NOT NULL)
        OR (status <> 'امضا شده' AND signed_by IS NULL AND signed_at IS NULL)
      ) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'letter_referrals_completion_consistency'
      AND conrelid = 'public.letter_referrals'::regclass
  ) THEN
    ALTER TABLE public.letter_referrals
      ADD CONSTRAINT letter_referrals_completion_consistency
      CHECK (
        (status = 'pending' AND completed_by IS NULL AND completed_at IS NULL)
        OR (status = 'done' AND completed_by IS NOT NULL AND completed_at IS NOT NULL)
      ) NOT VALID;
  END IF;
END $$;

GRANT UPDATE (status, completed_by, completed_at)
  ON public.letter_referrals TO authenticated;

DROP POLICY IF EXISTS letter_referrals_recipient_complete ON public.letter_referrals;
CREATE POLICY letter_referrals_recipient_complete
  ON public.letter_referrals
  FOR UPDATE TO authenticated
  USING (
    status = 'pending'
    AND (SELECT public.current_app_role()) IN ('manager', 'expert')
    AND (
      referred_to = (SELECT auth.uid())
      OR (SELECT public.current_app_role()) = 'manager'
    )
  )
  WITH CHECK (
    status = 'done'
    AND completed_by = (SELECT auth.uid())
    AND completed_at IS NOT NULL
    AND (SELECT public.current_app_role()) IN ('manager', 'expert')
    AND (
      referred_to = (SELECT auth.uid())
      OR (SELECT public.current_app_role()) = 'manager'
    )
  );

CREATE OR REPLACE FUNCTION public.guard_letter_signature()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_role text;
BEGIN
  actor_role := public.current_app_role();

  IF TG_OP = 'UPDATE' THEN
    IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
      RAISE EXCEPTION 'ثبت‌کننده اولیه نامه قابل تغییر نیست.' USING ERRCODE = '42501';
    END IF;
    IF OLD.status = 'امضا شده' THEN
      RAISE EXCEPTION 'نامه امضا شده برای حفظ سابقه اداری قابل ویرایش نیست.' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NEW.status = 'ارجاع شده' THEN
    IF TG_OP = 'INSERT' OR NOT EXISTS (
      SELECT 1 FROM public.letter_referrals r WHERE r.letter_id = NEW.id
    ) THEN
      RAISE EXCEPTION 'وضعیت ارجاع فقط پس از ثبت ارجاع معتبر است.' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.status = 'امضا شده' THEN
    IF actor_role IS DISTINCT FROM 'manager' THEN
      RAISE EXCEPTION 'ثبت امضای نهایی فقط توسط مدیر مجاز است.' USING ERRCODE = '42501';
    END IF;
    IF TG_OP = 'INSERT'
      OR NOT EXISTS (
        SELECT 1 FROM public.letter_referrals r WHERE r.letter_id = NEW.id
      )
      OR EXISTS (
        SELECT 1 FROM public.letter_referrals r
        WHERE r.letter_id = NEW.id AND r.status <> 'done'
      )
    THEN
      RAISE EXCEPTION 'پیش از امضای مدیر، ارجاع کارشناسی باید ثبت و تکمیل شود.' USING ERRCODE = '23514';
    END IF;
    NEW.signed_by := auth.uid();
    NEW.signed_at := now();
  ELSE
    NEW.signed_by := NULL;
    NEW.signed_at := NULL;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_letter_signature() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS letters_guard_signature ON public.letters;
CREATE TRIGGER letters_guard_signature
  BEFORE INSERT OR UPDATE ON public.letters
  FOR EACH ROW EXECUTE FUNCTION public.guard_letter_signature();

CREATE OR REPLACE FUNCTION public.prevent_signed_letter_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.status = 'امضا شده' THEN
    RAISE EXCEPTION 'نامه امضا شده قابل حذف نیست.' USING ERRCODE = '42501';
  END IF;
  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_signed_letter_delete() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS letters_prevent_signed_delete ON public.letters;
CREATE TRIGGER letters_prevent_signed_delete
  BEFORE DELETE ON public.letters
  FOR EACH ROW EXECUTE FUNCTION public.prevent_signed_letter_delete();

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
BEGIN
  v_role := public.current_app_role();
  IF v_role IS NULL OR v_role NOT IN ('manager', 'expert') THEN
    RAISE EXCEPTION 'دسترسی مجاز نیست.' USING ERRCODE = '42501';
  END IF;
  IF p_action IS NULL OR p_action NOT IN ('review', 'follow-up', 'signature') THEN
    RAISE EXCEPTION 'نوع ارجاع معتبر نیست.' USING ERRCODE = '22023';
  END IF;
  IF p_note IS NOT NULL AND length(p_note) > 2000 THEN
    RAISE EXCEPTION 'توضیح ارجاع بیش از حد مجاز است.' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = p_referred_to
      AND p.role IN ('manager', 'expert')
      AND p.is_active = true
      AND p.approval_status = 'approved'
  ) THEN
    RAISE EXCEPTION 'گیرنده ارجاع فعال و تأییدشده نیست.' USING ERRCODE = '23514';
  END IF;

  PERFORM 1 FROM public.letters l
  WHERE l.id = p_letter_id
    AND l.status NOT IN ('امضا شده', 'مختومه')
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'نامه پیدا نشد، مختومه است یا قبلاً امضا شده است.' USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.letter_referrals (letter_id, referred_to, action, note, created_by)
  VALUES (p_letter_id, p_referred_to, p_action, NULLIF(btrim(p_note), ''), auth.uid())
  RETURNING id INTO v_referral_id;

  UPDATE public.letters SET status = 'ارجاع شده' WHERE id = p_letter_id;
  RETURN v_referral_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_letter_referral(uuid, uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_letter_referral(uuid, uuid, text, text) TO authenticated;
