-- Add indexes for foreign keys identified by Supabase Performance Advisor.
CREATE INDEX IF NOT EXISTS driver_messages_sender_id_idx ON public.driver_messages (sender_id);
CREATE INDEX IF NOT EXISTS leave_requests_requested_by_idx ON public.leave_requests (requested_by);
CREATE INDEX IF NOT EXISTS leave_requests_reviewed_by_idx ON public.leave_requests (reviewed_by);
CREATE INDEX IF NOT EXISTS letter_referrals_created_by_idx ON public.letter_referrals (created_by);
CREATE INDEX IF NOT EXISTS letters_created_by_idx ON public.letters (created_by);
