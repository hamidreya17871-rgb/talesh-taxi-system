-- Letter priority, deadline tracking, immutable workflow history and in-app due alerts.
-- Defaults are configurable by managers: normal=5, urgent=2, immediate=1 working days.
-- Iranian weekend (Thursday/Friday) is excluded; official holidays need a maintained calendar.

ALTER TABLE public.letters
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS response_due_at timestamptz;

ALTER TABLE public.letters
  DROP CONSTRAINT IF EXISTS letters_priority_check;
ALTER TABLE public.letters
  ADD CONSTRAINT letters_priority_check
  CHECK (priority IN ('normal', 'urgent', 'immediate'));

CREATE TABLE IF NOT EXISTS public.letter_priority_settings (
  priority text PRIMARY KEY CHECK (priority IN ('normal', 'urgent', 'immediate')),
  working_days integer NOT NULL CHECK (working_days BETWEEN 1 AND 30),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL
);

INSERT INTO public.letter_priority_settings(priority, working_days)
VALUES ('normal', 5), ('urgent', 2), ('immediate', 1)
ON CONFLICT (priority) DO NOTHING;

ALTER TABLE public.letter_priority_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS letter_priority_settings_read ON public.letter_priority_settings;
CREATE POLICY letter_priority_settings_read ON public.letter_priority_settings
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS letter_priority_settings_manager_update ON public.letter_priority_settings;
CREATE POLICY letter_priority_settings_manager_update ON public.letter_priority_settings
  FOR UPDATE TO authenticated
  USING ((SELECT public.current_app_role()) = 'manager')
  WITH CHECK ((SELECT public.current_app_role()) = 'manager');


CREATE TABLE IF NOT EXISTS public.letter_holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  holiday_date date NOT NULL UNIQUE,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 120),
  created_by uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.letter_holidays ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS letter_holidays_read ON public.letter_holidays;
CREATE POLICY letter_holidays_read ON public.letter_holidays
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS letter_holidays_manager_insert ON public.letter_holidays;
CREATE POLICY letter_holidays_manager_insert ON public.letter_holidays
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.current_app_role()) = 'manager' AND created_by = (SELECT auth.uid()));
DROP POLICY IF EXISTS letter_holidays_manager_delete ON public.letter_holidays;
CREATE POLICY letter_holidays_manager_delete ON public.letter_holidays
  FOR DELETE TO authenticated
  USING ((SELECT public.current_app_role()) = 'manager');
GRANT SELECT ON public.letter_holidays TO authenticated;
GRANT INSERT, DELETE ON public.letter_holidays TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_letter_priority_setting_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $
BEGIN
  IF public.current_app_role() IS DISTINCT FROM 'manager' THEN
    RAISE EXCEPTION 'فقط مدیر سازمان می‌تواند مهلت‌ها را تغییر دهد.' USING ERRCODE = '42501';
  END IF;
  NEW.updated_by := auth.uid();
  NEW.updated_at := now();
  RETURN NEW;
END;
$;
REVOKE ALL ON FUNCTION public.guard_letter_priority_setting_update() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS letter_priority_settings_guard ON public.letter_priority_settings;
CREATE TRIGGER letter_priority_settings_guard
  BEFORE UPDATE ON public.letter_priority_settings
  FOR EACH ROW EXECUTE FUNCTION public.guard_letter_priority_setting_update();

CREATE OR REPLACE FUNCTION public.calculate_letter_due_at(p_priority text, p_start timestamptz DEFAULT now())
RETURNS timestamptz
LANGUAGE plpgsql STABLE
SET search_path = ''
AS $$
DECLARE
  v_days integer;
  v_result timestamptz := p_start;
  v_added integer := 0;
BEGIN
  SELECT s.working_days INTO v_days
  FROM public.letter_priority_settings s
  WHERE s.priority = p_priority;
  IF v_days IS NULL THEN
    RAISE EXCEPTION 'اولویت نامه معتبر نیست.' USING ERRCODE = '22023';
  END IF;
  WHILE v_added < v_days LOOP
    v_result := v_result + interval '1 day';
    -- ISO weekday: Thursday=4, Friday=5 in the Iranian work week.
    IF extract(isodow FROM (v_result AT TIME ZONE 'Asia/Tehran'))::integer NOT IN (4, 5)
       AND NOT EXISTS (SELECT 1 FROM public.letter_holidays h WHERE h.holiday_date = (v_result AT TIME ZONE 'Asia/Tehran')::date) THEN
      v_added := v_added + 1;
    END IF;
  END LOOP;
  RETURN v_result;
END;
$$;

CREATE TABLE IF NOT EXISTS public.letter_workflow_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  letter_id uuid NOT NULL REFERENCES public.letters(id) ON DELETE RESTRICT,
  referral_id uuid REFERENCES public.letter_referrals(id) ON DELETE RESTRICT,
  actor_id uuid REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  event_type text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS letter_workflow_events_letter_created_idx
  ON public.letter_workflow_events(letter_id, created_at DESC);

ALTER TABLE public.letter_workflow_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS letter_workflow_events_read ON public.letter_workflow_events;
CREATE POLICY letter_workflow_events_read ON public.letter_workflow_events
  FOR SELECT TO authenticated
  USING (
    (SELECT public.current_app_role()) = 'manager'
    OR actor_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.letter_referrals r
      WHERE r.id = letter_workflow_events.referral_id
        AND (r.referred_to = (SELECT auth.uid()) OR r.created_by = (SELECT auth.uid()))
    )
    OR EXISTS (
      SELECT 1 FROM public.letter_referrals r
      WHERE r.letter_id = letter_workflow_events.letter_id
        AND (r.referred_to = (SELECT auth.uid()) OR r.created_by = (SELECT auth.uid()))
    )
  );

CREATE TABLE IF NOT EXISTS public.staff_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  notification_type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  letter_id uuid REFERENCES public.letters(id) ON DELETE CASCADE,
  referral_id uuid REFERENCES public.letter_referrals(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  UNIQUE (referral_id, notification_type)
);
CREATE INDEX IF NOT EXISTS staff_notifications_user_unread_idx
  ON public.staff_notifications(user_id, created_at DESC) WHERE read_at IS NULL;
ALTER TABLE public.staff_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS staff_notifications_read_own ON public.staff_notifications;
CREATE POLICY staff_notifications_read_own ON public.staff_notifications
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS staff_notifications_mark_own ON public.staff_notifications;
CREATE POLICY staff_notifications_mark_own ON public.staff_notifications
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

GRANT SELECT ON public.letter_priority_settings, public.letter_workflow_events, public.staff_notifications TO authenticated;
DROP POLICY IF EXISTS letter_referrals_manager_read_all ON public.letter_referrals;
CREATE POLICY letter_referrals_manager_read_all ON public.letter_referrals
  FOR SELECT TO authenticated USING ((SELECT public.current_app_role()) = 'manager');
GRANT UPDATE (read_at) ON public.staff_notifications TO authenticated;
GRANT UPDATE (working_days, updated_at, updated_by) ON public.letter_priority_settings TO authenticated;

CREATE OR REPLACE FUNCTION public.audit_letter_workflow_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_letter_id uuid;
  v_referral_id uuid;
  v_type text;
  v_details jsonb;
  v_changed_fields text[] := ARRAY[]::text[];
BEGIN
  IF TG_TABLE_NAME = 'letters' THEN
    v_letter_id := NEW.id;
    IF TG_OP = 'INSERT' THEN
      v_type := 'letter_registered';
      v_details := jsonb_build_object('status', NEW.status, 'priority', NEW.priority);
    ELSE
      IF NEW.priority IS DISTINCT FROM OLD.priority THEN
        v_type := 'priority_changed';
        v_details := jsonb_build_object('from', OLD.priority, 'to', NEW.priority);
      ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
        v_type := 'status_changed';
        v_details := jsonb_build_object('from', OLD.status, 'to', NEW.status);
      ELSE
        IF NEW.subject IS DISTINCT FROM OLD.subject THEN v_changed_fields := array_append(v_changed_fields, 'subject'); END IF;
        IF NEW.body IS DISTINCT FROM OLD.body THEN v_changed_fields := array_append(v_changed_fields, 'body'); END IF;
        IF NEW.correspondent IS DISTINCT FROM OLD.correspondent THEN v_changed_fields := array_append(v_changed_fields, 'correspondent'); END IF;
        IF NEW.letter_no IS DISTINCT FROM OLD.letter_no THEN v_changed_fields := array_append(v_changed_fields, 'letter_no'); END IF;
        IF NEW.letter_date IS DISTINCT FROM OLD.letter_date THEN v_changed_fields := array_append(v_changed_fields, 'letter_date'); END IF;
        IF NEW.attachment_path IS DISTINCT FROM OLD.attachment_path THEN v_changed_fields := array_append(v_changed_fields, 'attachment_path'); END IF;
        IF cardinality(v_changed_fields) = 0 THEN RETURN NEW; END IF;
        v_type := 'letter_edited';
        v_details := jsonb_build_object('changed_fields', v_changed_fields);
      END IF;
    END IF;
  ELSE
    v_letter_id := NEW.letter_id;
    v_referral_id := NEW.id;
    IF TG_OP = 'INSERT' THEN
      v_type := 'referred';
      v_details := jsonb_build_object('to', NEW.referred_to, 'action', NEW.action, 'note', NEW.note);
    ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
      v_type := CASE WHEN NEW.status = 'done' THEN 'referral_completed' ELSE 'referral_status_changed' END;
      v_details := jsonb_build_object('from', OLD.status, 'to', NEW.status);
    ELSE
      RETURN NEW;
    END IF;
  END IF;

  IF TG_TABLE_NAME = 'letter_referrals' AND TG_OP = 'UPDATE' AND NEW.status = 'done'
     AND NOT EXISTS (SELECT 1 FROM public.letter_referrals r WHERE r.letter_id = NEW.letter_id AND r.status = 'pending' AND r.id <> NEW.id) THEN
    UPDATE public.letters SET response_due_at = NULL WHERE id = NEW.letter_id;
  END IF;

  INSERT INTO public.letter_workflow_events(letter_id, referral_id, actor_id, event_type, details)
  VALUES (v_letter_id, v_referral_id, auth.uid(), v_type, COALESCE(v_details, '{}'::jsonb));
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.audit_letter_workflow_event() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS letters_workflow_audit ON public.letters;
CREATE TRIGGER letters_workflow_audit
  AFTER INSERT OR UPDATE ON public.letters
  FOR EACH ROW EXECUTE FUNCTION public.audit_letter_workflow_event();
DROP TRIGGER IF EXISTS referrals_workflow_audit ON public.letter_referrals;
CREATE TRIGGER referrals_workflow_audit
  AFTER INSERT OR UPDATE OF status ON public.letter_referrals
  FOR EACH ROW EXECUTE FUNCTION public.audit_letter_workflow_event();

CREATE OR REPLACE FUNCTION public.set_letter_referral_deadline()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_priority text;
  v_due_at timestamptz;
BEGIN
  SELECT l.priority INTO v_priority FROM public.letters l WHERE l.id = NEW.letter_id;
  v_due_at := public.calculate_letter_due_at(COALESCE(v_priority, 'normal'), NEW.created_at);
  NEW.due_at := v_due_at;
  UPDATE public.letters SET response_due_at = v_due_at WHERE id = NEW.letter_id;
  RETURN NEW;
END;
$$;

ALTER TABLE public.letter_referrals
  ADD COLUMN IF NOT EXISTS due_at timestamptz,
  ADD COLUMN IF NOT EXISTS due_notified_at timestamptz;
CREATE INDEX IF NOT EXISTS letter_referrals_due_pending_idx
  ON public.letter_referrals(due_at) WHERE status = 'pending' AND due_notified_at IS NULL;

DROP TRIGGER IF EXISTS referrals_set_deadline ON public.letter_referrals;
CREATE TRIGGER referrals_set_deadline
  BEFORE INSERT ON public.letter_referrals
  FOR EACH ROW EXECUTE FUNCTION public.set_letter_referral_deadline();

UPDATE public.letter_referrals
SET due_at = public.calculate_letter_due_at(COALESCE((SELECT l.priority FROM public.letters l WHERE l.id = letter_referrals.letter_id), 'normal'), created_at)
WHERE status = 'pending' AND due_at IS NULL;
UPDATE public.letters l
SET response_due_at = deadlines.first_due
FROM (
  SELECT letter_id, min(due_at) AS first_due
  FROM public.letter_referrals
  WHERE status = 'pending' AND due_at IS NOT NULL
  GROUP BY letter_id
) deadlines
WHERE l.id = deadlines.letter_id AND l.response_due_at IS NULL;

-- Seed the timeline for records that predate this migration.
INSERT INTO public.letter_workflow_events(letter_id, actor_id, event_type, details, created_at)
SELECT l.id, l.created_by, 'letter_registered', jsonb_build_object('status', l.status, 'priority', l.priority), l.created_at
FROM public.letters l;
INSERT INTO public.letter_workflow_events(letter_id, referral_id, actor_id, event_type, details, created_at)
SELECT r.letter_id, r.id, r.created_by, 'referred', jsonb_build_object('to', r.referred_to, 'action', r.action, 'note', r.note), r.created_at
FROM public.letter_referrals r;
INSERT INTO public.letter_workflow_events(letter_id, referral_id, actor_id, event_type, details, created_at)
SELECT r.letter_id, r.id, r.completed_by, 'referral_completed', jsonb_build_object('from', 'pending', 'to', 'done'), COALESCE(r.completed_at, r.created_at)
FROM public.letter_referrals r
WHERE r.status = 'done';

CREATE OR REPLACE FUNCTION public.sync_letter_priority_deadlines()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $ 
BEGIN
  IF NEW.priority IS DISTINCT FROM OLD.priority THEN
    UPDATE public.letter_referrals r
    SET due_at = public.calculate_letter_due_at(NEW.priority, r.created_at),
        due_notified_at = NULL
    WHERE r.letter_id = NEW.id AND r.status = 'pending';
    UPDATE public.letters l
    SET response_due_at = (
      SELECT min(r.due_at) FROM public.letter_referrals r
      WHERE r.letter_id = NEW.id AND r.status = 'pending'
    )
    WHERE l.id = NEW.id;
  END IF;
  RETURN NEW;
END;
$;
REVOKE ALL ON FUNCTION public.sync_letter_priority_deadlines() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS letters_sync_priority_deadlines ON public.letters;
CREATE TRIGGER letters_sync_priority_deadlines
  AFTER UPDATE OF priority ON public.letters
  FOR EACH ROW EXECUTE FUNCTION public.sync_letter_priority_deadlines();


CREATE OR REPLACE FUNCTION public.refresh_letter_deadlines()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $
BEGIN
  UPDATE public.letter_referrals r
  SET due_at = public.calculate_letter_due_at(l.priority, r.created_at)
  FROM public.letters l
  WHERE l.id = r.letter_id
    AND r.status = 'pending';
  UPDATE public.letters l
  SET response_due_at = (
    SELECT min(r.due_at) FROM public.letter_referrals r
    WHERE r.letter_id = l.id AND r.status = 'pending'
  )
  WHERE EXISTS (
    SELECT 1 FROM public.letter_referrals r
    WHERE r.letter_id = l.id AND r.status = 'pending'
  );
  RETURN NULL;
END;
$;
REVOKE ALL ON FUNCTION public.refresh_letter_deadlines() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS letter_priority_settings_refresh_deadlines ON public.letter_priority_settings;
CREATE TRIGGER letter_priority_settings_refresh_deadlines
  AFTER UPDATE OF working_days ON public.letter_priority_settings
  FOR EACH ROW EXECUTE FUNCTION public.refresh_letter_deadlines();
DROP TRIGGER IF EXISTS letter_holidays_refresh_deadlines ON public.letter_holidays;
CREATE TRIGGER letter_holidays_refresh_deadlines
  AFTER INSERT OR DELETE ON public.letter_holidays
  FOR EACH ROW EXECUTE FUNCTION public.refresh_letter_deadlines();

CREATE OR REPLACE FUNCTION public.dispatch_due_letter_notifications()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  WITH due AS (
    SELECT r.id, r.letter_id, r.referred_to, l.letter_no, l.subject
    FROM public.letter_referrals r
    JOIN public.letters l ON l.id = r.letter_id
    WHERE r.status = 'pending'
      AND r.due_at <= now()
      AND r.due_notified_at IS NULL
    FOR UPDATE OF r SKIP LOCKED
  ), inserted AS (
    INSERT INTO public.staff_notifications(user_id, notification_type, title, body, letter_id, referral_id)
    SELECT referred_to, 'letter_due', 'سررسید نامه فرا رسیده است',
      'نامه شماره ' || letter_no::text || ' با موضوع «' || COALESCE(subject, 'بدون موضوع') || '» نیازمند اقدام و تنظیم پاسخ است.',
      letter_id, id
    FROM due
    ON CONFLICT (referral_id, notification_type) DO NOTHING
    RETURNING referral_id
  )
  UPDATE public.letter_referrals r
  SET due_notified_at = now()
  FROM due
  WHERE r.id = due.id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.dispatch_due_letter_notifications() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'dispatch-due-letter-notifications';
    PERFORM cron.schedule(
      'dispatch-due-letter-notifications',
      '*/5 * * * *',
      'SELECT public.dispatch_due_letter_notifications();'
    );
  ELSE
    RAISE NOTICE 'pg_cron is not enabled; due-letter notifications require a scheduled invocation of public.dispatch_due_letter_notifications().';
  END IF;
END $$;


-- Notify the app in real time when a deadline alert is inserted.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'staff_notifications'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.staff_notifications;
  END IF;
END $$;
