-- Reconcile the legacy Secretariat signature guard with the newer outgoing-letter workflow.
-- The feature/administrative-workflows migration owns outgoing approval via
-- expert_reviewed_* and manager_signed_* fields. Keep referral completion/RPC
-- from 20261116100000, but remove its incompatible legacy signature trigger
-- and check constraint. No existing letter or referral rows are deleted.

DROP TRIGGER IF EXISTS letters_guard_signature ON public.letters;
ALTER TABLE public.letters
  DROP CONSTRAINT IF EXISTS letters_signature_consistency;

DROP FUNCTION IF EXISTS public.guard_letter_signature();
