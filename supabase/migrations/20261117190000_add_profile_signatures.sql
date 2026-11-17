ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS signature_data_url text;

COMMENT ON COLUMN public.profiles.signature_data_url IS
  'Staff member handwritten signature as a PNG data URL for approved official documents.';
