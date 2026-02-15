-- Create storage bucket for booth photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('booth-photos', 'booth-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public uploads to booth-photos
CREATE POLICY "Allow public uploads" ON storage.objects
FOR INSERT TO anon, authenticated
WITH CHECK (bucket_id = 'booth-photos');

-- Allow public reads from booth-photos
CREATE POLICY "Allow public reads" ON storage.objects
FOR SELECT TO anon, authenticated
USING (bucket_id = 'booth-photos');
