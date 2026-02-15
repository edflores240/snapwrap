-- Allow viewing photos (Public needs to see them, Admin needs to see all)
-- For now, we allow public access to all rows, and filter by is_published in the client/query for public pages.
-- A stricter policy would be:
-- USING (auth.role() = 'authenticated' OR is_published = true)

CREATE POLICY "Anyone can view photos"
  ON public.photos FOR SELECT
  USING (true);
