-- Add is_published column to photos for admin unpublish control
ALTER TABLE public.photos ADD COLUMN IF NOT EXISTS is_published boolean DEFAULT true;

-- Allow deletion of photos
CREATE POLICY "Anyone can delete photos"
  ON public.photos FOR DELETE
  USING (true);

-- Allow updating photos (for publish/unpublish)
CREATE POLICY "Anyone can update photos"
  ON public.photos FOR UPDATE
  USING (true)
  WITH CHECK (true);
