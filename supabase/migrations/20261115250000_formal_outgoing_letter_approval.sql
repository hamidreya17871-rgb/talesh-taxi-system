/*
  Formal outgoing-letter approval and dispatch controls.
  Additive only: existing letters and audit rows are retained.
*/
ALTER TABLE public.letters
  ADD COLUMN IF NOT EXISTS expert_reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS expert_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS manager_signed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS manager_signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS manager_order_note text,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS sent_method text,
  ADD COLUMN IF NOT EXISTS delivery_receipt_path text;

ALTER TABLE public.letters
  DROP CONSTRAINT IF EXISTS letters_manager_order_note_length_check,
  DROP CONSTRAINT IF EXISTS letters_sent_method_length_check;

ALTER TABLE public.letters
  ADD CONSTRAINT letters_manager_order_note_length_check
    CHECK (manager_order_note IS NULL OR char_length(manager_order_note) <= 3000) NOT VALID,
  ADD CONSTRAINT letters_sent_method_length_check
    CHECK (sent_method IS NULL OR char_length(sent_method) <= 120) NOT VALID;

CREATE INDEX IF NOT EXISTS letters_outgoing_approval_queue_idx
  ON public.letters (created_at DESC)
  WHERE direction = 'outgoing'
    AND deleted_at IS NULL
    AND status IN ('در انتظار بررسی کارشناس', 'در انتظار تأیید مدیر', 'امضا شده');

CREATE OR REPLACE FUNCTION public.guard_outgoing_letter_workflow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_role text := public.current_app_role();
  v_content_changed boolean;
BEGIN
  IF NEW.direction <> 'outgoing' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'ثبت شده' THEN
      RAISE EXCEPTION 'New outgoing letters must start as registered and enter review through the controlled workflow';
    END IF;
    RETURN NEW;
  END IF;

  v_content_changed :=
    NEW.subject IS DISTINCT FROM OLD.subject
    OR NEW.body IS DISTINCT FROM OLD.body
    OR NEW.correspondent IS DISTINCT FROM OLD.correspondent
    OR NEW.letter_date IS DISTINCT FROM OLD.letter_date
    OR NEW.attachment_path IS DISTINCT FROM OLD.attachment_path
    OR NEW.letter_no IS DISTINCT FROM OLD.letter_no;

  IF OLD.status IN ('امضا شده', 'صادر شده', 'مختومه') AND v_content_changed THEN
    RAISE EXCEPTION 'Signed outgoing letters are immutable; issue a corrected version instead';
  END IF;

  IF NEW.expert_reviewed_by IS DISTINCT FROM OLD.expert_reviewed_by
     OR NEW.expert_reviewed_at IS DISTINCT FROM OLD.expert_reviewed_at THEN
    IF v_role <> 'expert'
       OR NEW.expert_reviewed_by IS DISTINCT FROM auth.uid()
       OR NEW.expert_reviewed_at IS NULL
       OR NEW.status <> 'در انتظار تأیید مدیر' THEN
      RAISE EXCEPTION 'Expert review must be recorded by the authenticated expert during submission to manager';
    END IF;
  END IF;

  IF NEW.manager_signed_by IS DISTINCT FROM OLD.manager_signed_by
     OR NEW.manager_signed_at IS DISTINCT FROM OLD.manager_signed_at
     OR NEW.manager_order_note IS DISTINCT FROM OLD.manager_order_note THEN
    IF v_role <> 'manager'
       OR NEW.manager_signed_by IS DISTINCT FROM auth.uid()
       OR NEW.manager_signed_at IS NULL
       OR NULLIF(btrim(NEW.manager_order_note), '') IS NULL
       OR NEW.status <> 'امضا شده'
       OR OLD.status <> 'در انتظار تأیید مدیر' THEN
      RAISE EXCEPTION 'Manager signature requires an authenticated manager order and approval transition';
    END IF;
  END IF;

  IF NEW.sent_at IS DISTINCT FROM OLD.sent_at
     OR NEW.sent_method IS DISTINCT FROM OLD.sent_method
     OR NEW.delivery_receipt_path IS DISTINCT FROM OLD.delivery_receipt_path THEN
    IF v_role <> 'manager'
       OR NEW.status <> 'صادر شده'
       OR OLD.status <> 'امضا شده'
       OR NEW.sent_at IS NULL
       OR NULLIF(btrim(NEW.sent_method), '') IS NULL THEN
      RAISE EXCEPTION 'Dispatch details can only be recorded by a manager when a signed letter is issued';
    END IF;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status NOT IN (
      'ثبت شده', 'در حال بررسی', 'ارجاع شده',
      'در انتظار بررسی کارشناس', 'در انتظار تأیید مدیر',
      'امضا شده', 'صادر شده', 'در انتظار پاسخ', 'مختومه'
    ) THEN
      RAISE EXCEPTION 'Unsupported outgoing letter status';
    END IF;

    IF NEW.status = 'در انتظار تأیید مدیر' THEN
      IF v_role <> 'expert'
         OR NEW.expert_reviewed_by IS DISTINCT FROM auth.uid()
         OR NEW.expert_reviewed_at IS NULL THEN
        RAISE EXCEPTION 'Only an expert can submit a reviewed letter to the manager';
      END IF;
    ELSIF NEW.status = 'امضا شده' THEN
      IF v_role <> 'manager'
         OR OLD.status <> 'در انتظار تأیید مدیر'
         OR NEW.manager_signed_by IS DISTINCT FROM auth.uid()
         OR NEW.manager_signed_at IS NULL
         OR NULLIF(btrim(NEW.manager_order_note), '') IS NULL THEN
        RAISE EXCEPTION 'Only the manager can sign a reviewed outgoing letter with an order note';
      END IF;
    ELSIF NEW.status = 'صادر شده' THEN
      IF v_role <> 'manager'
         OR OLD.status <> 'امضا شده'
         OR NEW.sent_at IS NULL
         OR NULLIF(btrim(NEW.sent_method), '') IS NULL THEN
        RAISE EXCEPTION 'Only a signed letter can be issued with dispatch details';
      END IF;
    ELSIF NEW.status = 'مختومه' THEN
      IF v_role <> 'manager' OR OLD.status <> 'صادر شده' THEN
        RAISE EXCEPTION 'Only the manager can close a dispatched outgoing letter';
      END IF;
    ELSIF v_role NOT IN ('manager', 'expert') THEN
      RAISE EXCEPTION 'Only authorized administrative staff can change outgoing letter status';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_outgoing_letter_workflow() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guard_outgoing_letter_workflow ON public.letters;
CREATE TRIGGER guard_outgoing_letter_workflow
  BEFORE INSERT OR UPDATE ON public.letters
  FOR EACH ROW EXECUTE FUNCTION public.guard_outgoing_letter_workflow();
