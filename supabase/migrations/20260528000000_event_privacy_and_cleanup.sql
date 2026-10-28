-- ============================================================
-- Event privacy + complete cleanup when an event is deleted
-- ============================================================

-- 1. Visibility: 'public' events are listed in the owner's portfolio, 'private' ("only me") are not.
--    Existing events stay public so nothing disappears from portfolios.
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public';
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_visibility_check;
ALTER TABLE public.events ADD CONSTRAINT events_visibility_check CHECK (visibility IN ('public', 'private'));
CREATE INDEX IF NOT EXISTS events_user_id_visibility_idx ON public.events (user_id, visibility);


-- 2. Deleting an event deletes its photo rows (the old foreign key had no cascade)
DO $$
DECLARE c text;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.photos'::regclass AND contype = 'f' AND confrelid = 'public.events'::regclass
  LOOP
    EXECUTE format('ALTER TABLE public.photos DROP CONSTRAINT %I', c);
  END LOOP;
  ALTER TABLE public.photos
    ADD CONSTRAINT photos_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;
END $$;


-- 3. Booth photos are inserted by anonymous guests, so user_id was left NULL and the owner's
--    row-level policy could not see (or delete) them. Stamp the event owner on insert.
CREATE OR REPLACE FUNCTION public.set_photo_owner() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.user_id IS NULL AND NEW.event_id IS NOT NULL THEN
    SELECT user_id INTO NEW.user_id FROM public.events WHERE id = NEW.event_id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS photos_set_owner ON public.photos;
CREATE TRIGGER photos_set_owner BEFORE INSERT ON public.photos
  FOR EACH ROW EXECUTE FUNCTION public.set_photo_owner();

UPDATE public.photos p SET user_id = e.user_id
FROM public.events e
WHERE p.event_id = e.id AND p.user_id IS NULL;


-- 4. Let owners delete the files under their own events' folders ("<event-slug>/...") in the bucket
DROP POLICY IF EXISTS "Owners delete their event files" ON storage.objects;
CREATE POLICY "Owners delete their event files" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'booth-photos'
    AND (storage.foldername(name))[1] IN (SELECT slug FROM public.events WHERE user_id = auth.uid())
  );
