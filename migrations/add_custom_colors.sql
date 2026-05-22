-- Add custom_colors column to profiles table
-- This stores per-user color customizations as a JSON object
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS custom_colors jsonb DEFAULT NULL;

-- Example structure:
-- {
--   "bg": "#FFF8F0",
--   "surface": "#FFFFFF", 
--   "text": "#171717",
--   "muted": "#8B7355",
--   "border": "#F0E8DC",
--   "card": "#FFFCF8"
-- }
