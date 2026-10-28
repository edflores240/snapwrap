-- Small (~480px) version of each photo for grids; image_url stays the full-size original
ALTER TABLE public.photos ADD COLUMN IF NOT EXISTS thumb_url text;
