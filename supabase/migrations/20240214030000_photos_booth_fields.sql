-- Add event_id and image_url to photos table for booth composites
ALTER TABLE public.photos ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES public.events(id);
ALTER TABLE public.photos ADD COLUMN IF NOT EXISTS image_url text;

-- Create storage bucket for booth photos (run in Supabase Dashboard if needed)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('booth-photos', 'booth-photos', true);
