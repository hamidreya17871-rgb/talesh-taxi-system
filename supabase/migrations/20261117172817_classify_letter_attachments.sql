-- Classify every letter attachment without changing existing stored files.
ALTER TABLE public.letter_attachments
  ADD COLUMN IF NOT EXISTS document_type text NOT NULL DEFAULT 'attachment';

ALTER TABLE public.letter_attachments
  DROP CONSTRAINT IF EXISTS letter_attachments_document_type_check;

ALTER TABLE public.letter_attachments
  ADD CONSTRAINT letter_attachments_document_type_check
  CHECK (document_type IN (
    'incoming_letter','outgoing_letter','attachment','meeting_minutes',
    'inspection_report','leave_request','driver_document','vehicle_document','other'
  ));

CREATE INDEX IF NOT EXISTS letter_attachments_document_type_idx
  ON public.letter_attachments(document_type, created_at DESC);
