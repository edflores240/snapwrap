ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS custom_colors JSONB;
