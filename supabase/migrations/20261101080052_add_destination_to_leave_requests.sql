ALTER TABLE public.leave_requests
  ADD COLUMN IF NOT EXISTS destination_province text,
  ADD COLUMN IF NOT EXISTS destination_city text;

GRANT INSERT (destination_province, destination_city) ON public.leave_requests TO authenticated;
