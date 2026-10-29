-- ============================================================
-- Guest camera: every guest scans a QR code and takes a limited
-- number of photos from their own phone. Photos stay private until
-- the host's reveal time.
--
-- Settings live in events.config -> 'guestCamera' (JSON), so nothing
-- about the event row changes. Everything guests do goes through the
-- SECURITY DEFINER functions below, which enforce the shot limit, the
-- open/close window and the reveal time on the server.
-- ============================================================

-- 1. Guests (one row per phone/browser, no account needed)
CREATE TABLE IF NOT EXISTS public.guest_sessions (
  id            uuid PRIMARY KEY,
  event_id      uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name          text,
  table_label   text,
  quota_override integer,
  blocked       boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS guest_sessions_event_id_idx ON public.guest_sessions (event_id);

ALTER TABLE public.guest_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "guest_sessions_owner_all" ON public.guest_sessions;
CREATE POLICY "guest_sessions_owner_all" ON public.guest_sessions FOR ALL
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = guest_sessions.event_id AND e.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.events e WHERE e.id = guest_sessions.event_id AND e.user_id = auth.uid()));


-- 2. Guest columns on photos. Guest photos always have is_published = false, so none of the
--    existing galleries can show them; the album only reads them through guest_album().
ALTER TABLE public.photos
  ADD COLUMN IF NOT EXISTS guest_session_id uuid,
  ADD COLUMN IF NOT EXISTS guest_status text,
  ADD COLUMN IF NOT EXISTS caption text,
  ADD COLUMN IF NOT EXISTS prompt text,
  ADD COLUMN IF NOT EXISTS like_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.photos DROP CONSTRAINT IF EXISTS photos_guest_status_check;
ALTER TABLE public.photos ADD CONSTRAINT photos_guest_status_check
  CHECK (guest_status IS NULL OR guest_status IN ('pending', 'approved', 'hidden'));

ALTER TABLE public.photos DROP CONSTRAINT IF EXISTS photos_guest_session_id_fkey;
ALTER TABLE public.photos ADD CONSTRAINT photos_guest_session_id_fkey
  FOREIGN KEY (guest_session_id) REFERENCES public.guest_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS photos_guest_session_id_idx ON public.photos (guest_session_id) WHERE guest_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS photos_event_guest_status_idx ON public.photos (event_id, guest_status, created_at DESC) WHERE guest_session_id IS NOT NULL;


-- 3. The booth may still insert photos directly, but guest photos can only arrive through
--    guest_add_photo(), which is what enforces the shot limit.
DROP POLICY IF EXISTS "photos_guest_insert" ON public.photos;
CREATE POLICY "photos_guest_insert" ON public.photos FOR INSERT
  WITH CHECK (guest_session_id IS NULL AND guest_status IS NULL AND like_count = 0);


-- 4. Hearts in the album
CREATE TABLE IF NOT EXISTS public.photo_likes (
  photo_id   uuid NOT NULL REFERENCES public.photos(id) ON DELETE CASCADE,
  visitor_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (photo_id, visitor_id)
);
ALTER TABLE public.photo_likes ENABLE ROW LEVEL SECURITY;   -- no policies: only the functions touch it


-- 5. Guests can remove their own files (paths look like "<event-slug>/guest/<id>.jpg")
DROP POLICY IF EXISTS "Guests delete their own files" ON storage.objects;
CREATE POLICY "Guests delete their own files" ON storage.objects
  FOR DELETE TO anon, authenticated
  USING (bucket_id = 'booth-photos' AND (storage.foldername(name))[2] = 'guest');


-- ============================================================
-- Functions
-- ============================================================

-- The guest settings of an active event ('{}' when there are none)
CREATE OR REPLACE FUNCTION public.guest_cfg(p_event_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT CASE WHEN e.is_active THEN COALESCE(e.config -> 'guestCamera', '{}'::jsonb) ELSE '{}'::jsonb END
       FROM public.events e WHERE e.id = p_event_id),
    '{}'::jsonb);
$$;


-- Where a guest stands: phase of the event, shots used and left, whether the album is out
CREATE OR REPLACE FUNCTION public.guest_state(p_event_id uuid, p_session_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cfg     jsonb := public.guest_cfg(p_event_id);
  t_now   timestamptz := now();
  opens   timestamptz;
  closes  timestamptz;
  reveal  timestamptz;
  phase   text;
  quota   integer;
  used    integer := 0;
  joined  boolean := false;
  is_blocked boolean := false;
  sess    public.guest_sessions;
BEGIN
  IF NOT COALESCE((cfg ->> 'enabled')::boolean, false) THEN
    RETURN jsonb_build_object('enabled', false, 'now', t_now);
  END IF;

  opens  := NULLIF(cfg ->> 'opensAt', '')::timestamptz;
  closes := NULLIF(cfg ->> 'closesAt', '')::timestamptz;
  reveal := NULLIF(cfg ->> 'revealAt', '')::timestamptz;
  phase  := CASE
              WHEN opens IS NOT NULL AND t_now < opens THEN 'not_open'
              WHEN closes IS NOT NULL AND t_now >= closes THEN 'closed'
              ELSE 'open'
            END;
  quota  := COALESCE(NULLIF(cfg ->> 'shotsPerGuest', '')::integer, 10);

  IF p_session_id IS NOT NULL THEN
    SELECT * INTO sess FROM public.guest_sessions WHERE id = p_session_id AND event_id = p_event_id;
    IF FOUND THEN
      joined := true;
      is_blocked := sess.blocked;
      quota := COALESCE(sess.quota_override, quota);
      -- a photo the host hid gives the shot back
      SELECT count(*) INTO used FROM public.photos
        WHERE guest_session_id = p_session_id AND COALESCE(guest_status, '') <> 'hidden';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'enabled', true,
    'now', t_now,
    'phase', phase,
    'opensAt', opens,
    'closesAt', closes,
    'revealAt', reveal,
    'revealed', reveal IS NOT NULL AND t_now >= reveal,
    'joined', joined,
    'blocked', is_blocked,
    'quota', quota,
    'used', used
  );
END $$;


-- First visit (or a returning guest updating their name)
CREATE OR REPLACE FUNCTION public.guest_join(p_event_id uuid, p_session_id uuid, p_name text, p_table text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT COALESCE((public.guest_cfg(p_event_id) ->> 'enabled')::boolean, false) THEN
    RAISE EXCEPTION 'guest_disabled';
  END IF;

  INSERT INTO public.guest_sessions (id, event_id, name, table_label)
  VALUES (p_session_id, p_event_id, NULLIF(left(btrim(p_name), 60), ''), NULLIF(left(btrim(p_table), 30), ''))
  ON CONFLICT (id) DO UPDATE
    SET name = COALESCE(EXCLUDED.name, public.guest_sessions.name),
        table_label = COALESCE(EXCLUDED.table_label, public.guest_sessions.table_label),
        last_seen_at = now()
    WHERE public.guest_sessions.event_id = p_event_id;

  RETURN public.guest_state(p_event_id, p_session_id);
END $$;


-- Saves one uploaded photo, if the guest still has shots left and the camera is open
CREATE OR REPLACE FUNCTION public.guest_add_photo(
  p_event_id uuid, p_session_id uuid, p_photo_id uuid,
  p_image_url text, p_thumb_url text, p_storage_path text,
  p_caption text, p_prompt text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  st     jsonb;
  cfg    jsonb;
  sess   public.guest_sessions;
  slug_  text;
  status_ text;
BEGIN
  st := public.guest_state(p_event_id, p_session_id);
  IF NOT COALESCE((st ->> 'enabled')::boolean, false) THEN RAISE EXCEPTION 'guest_disabled'; END IF;

  SELECT * INTO sess FROM public.guest_sessions WHERE id = p_session_id AND event_id = p_event_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'guest_unknown'; END IF;
  IF sess.blocked THEN RAISE EXCEPTION 'guest_blocked'; END IF;

  -- A retry of an upload that already landed
  IF EXISTS (SELECT 1 FROM public.photos WHERE id = p_photo_id AND guest_session_id = p_session_id) THEN
    RETURN st;
  END IF;

  IF st ->> 'phase' <> 'open' THEN RAISE EXCEPTION 'guest_closed'; END IF;
  IF (st ->> 'used')::integer >= (st ->> 'quota')::integer THEN RAISE EXCEPTION 'guest_quota'; END IF;

  SELECT slug INTO slug_ FROM public.events WHERE id = p_event_id;
  IF p_storage_path NOT LIKE slug_ || '/guest/%' THEN RAISE EXCEPTION 'guest_bad_path'; END IF;

  cfg := public.guest_cfg(p_event_id);
  status_ := CASE WHEN COALESCE((cfg ->> 'requireApproval')::boolean, true) THEN 'pending' ELSE 'approved' END;

  INSERT INTO public.photos (id, event_id, storage_path, image_url, thumb_url, is_published, guest_session_id, guest_status, caption, prompt)
  VALUES (p_photo_id, p_event_id, p_storage_path, p_image_url, p_thumb_url, false, p_session_id, status_,
          NULLIF(left(btrim(p_caption), 200), ''), NULLIF(left(btrim(p_prompt), 120), ''));

  UPDATE public.guest_sessions SET last_seen_at = now() WHERE id = p_session_id;
  RETURN public.guest_state(p_event_id, p_session_id);
END $$;


-- A guest's own photos (never the ones the host hid)
CREATE OR REPLACE FUNCTION public.guest_my_photos(p_event_id uuid, p_session_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.created_at), '[]'::jsonb)
  FROM (
    SELECT id, image_url, thumb_url, caption, prompt, guest_status, like_count, created_at
    FROM public.photos
    WHERE event_id = p_event_id AND guest_session_id = p_session_id AND COALESCE(guest_status, '') <> 'hidden'
  ) x;
$$;


-- Deleting your own shot frees it up for a retake. Returns the file path so the app can remove the files.
CREATE OR REPLACE FUNCTION public.guest_delete_photo(p_photo_id uuid, p_session_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE sp text;
BEGIN
  DELETE FROM public.photos WHERE id = p_photo_id AND guest_session_id = p_session_id RETURNING storage_path INTO sp;
  RETURN jsonb_build_object('deleted', sp IS NOT NULL, 'storage_path', sp);
END $$;


-- The album: approved guest photos, only once the reveal time has passed
CREATE OR REPLACE FUNCTION public.guest_album(
  p_event_id uuid, p_visitor_id uuid, p_sort text, p_guest uuid, p_prompt text, p_limit integer, p_offset integer
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cfg    jsonb := public.guest_cfg(p_event_id);
  reveal timestamptz := NULLIF(public.guest_cfg(p_event_id) ->> 'revealAt', '')::timestamptz;
  total  integer;
  rows_  jsonb;
  facets jsonb;
BEGIN
  IF NOT COALESCE((cfg ->> 'enabled')::boolean, false) THEN
    RETURN jsonb_build_object('enabled', false);
  END IF;
  IF reveal IS NULL OR now() < reveal THEN
    RETURN jsonb_build_object('enabled', true, 'revealed', false, 'revealAt', reveal, 'now', now());
  END IF;

  SELECT count(*) INTO total FROM public.photos p
   WHERE p.event_id = p_event_id AND p.guest_status = 'approved'
     AND (p_guest IS NULL OR p.guest_session_id = p_guest)
     AND (p_prompt IS NULL OR p.prompt = p_prompt);

  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.rn), '[]'::jsonb) INTO rows_
  FROM (
    SELECT row_number() OVER (
             ORDER BY CASE WHEN p_sort = 'loved' THEN p.like_count END DESC NULLS LAST, p.created_at DESC
           ) AS rn,
           p.id, p.image_url, p.thumb_url, p.caption, p.prompt, p.like_count, p.created_at,
           s.name AS guest_name,
           EXISTS (SELECT 1 FROM public.photo_likes l WHERE l.photo_id = p.id AND l.visitor_id = p_visitor_id) AS liked
      FROM public.photos p
      LEFT JOIN public.guest_sessions s ON s.id = p.guest_session_id
     WHERE p.event_id = p_event_id AND p.guest_status = 'approved'
       AND (p_guest IS NULL OR p.guest_session_id = p_guest)
       AND (p_prompt IS NULL OR p.prompt = p_prompt)
     ORDER BY 1
     LIMIT GREATEST(p_limit, 1) OFFSET GREATEST(p_offset, 0)
  ) x;

  SELECT jsonb_build_object(
    'guests', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', g.id, 'name', g.name, 'count', g.n) ORDER BY g.n DESC)
      FROM (
        SELECT s.id, s.name, count(*) AS n FROM public.photos p JOIN public.guest_sessions s ON s.id = p.guest_session_id
         WHERE p.event_id = p_event_id AND p.guest_status = 'approved' AND s.name IS NOT NULL GROUP BY s.id, s.name
      ) g), '[]'::jsonb),
    'prompts', COALESCE((
      SELECT jsonb_agg(DISTINCT p.prompt) FROM public.photos p
       WHERE p.event_id = p_event_id AND p.guest_status = 'approved' AND p.prompt IS NOT NULL), '[]'::jsonb)
  ) INTO facets;

  RETURN jsonb_build_object('enabled', true, 'revealed', true, 'total', total, 'photos', rows_, 'facets', facets);
END $$;


-- Heart / un-heart a photo in the album
CREATE OR REPLACE FUNCTION public.guest_toggle_like(p_photo_id uuid, p_visitor_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ev     uuid;
  reveal timestamptz;
  was_liked boolean;
  cnt    integer;
BEGIN
  SELECT event_id INTO ev FROM public.photos WHERE id = p_photo_id AND guest_status = 'approved';
  IF ev IS NULL THEN RAISE EXCEPTION 'guest_unknown'; END IF;
  reveal := NULLIF(public.guest_cfg(ev) ->> 'revealAt', '')::timestamptz;
  IF reveal IS NULL OR now() < reveal THEN RAISE EXCEPTION 'guest_closed'; END IF;

  SELECT EXISTS (SELECT 1 FROM public.photo_likes WHERE photo_id = p_photo_id AND visitor_id = p_visitor_id) INTO was_liked;
  IF was_liked THEN
    DELETE FROM public.photo_likes WHERE photo_id = p_photo_id AND visitor_id = p_visitor_id;
  ELSE
    INSERT INTO public.photo_likes (photo_id, visitor_id) VALUES (p_photo_id, p_visitor_id) ON CONFLICT DO NOTHING;
  END IF;

  UPDATE public.photos SET like_count = (SELECT count(*) FROM public.photo_likes WHERE photo_id = p_photo_id)
   WHERE id = p_photo_id RETURNING like_count INTO cnt;
  RETURN jsonb_build_object('liked', NOT was_liked, 'like_count', cnt);
END $$;


-- Projector slideshow: newest approved guest photos plus the booth's published photos.
-- Only available when the host turned live slideshow on, or after the reveal.
CREATE OR REPLACE FUNCTION public.guest_slideshow(p_event_id uuid, p_limit integer) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cfg    jsonb := public.guest_cfg(p_event_id);
  reveal timestamptz := NULLIF(public.guest_cfg(p_event_id) ->> 'revealAt', '')::timestamptz;
  open_  boolean;
BEGIN
  IF NOT COALESCE((cfg ->> 'enabled')::boolean, false) THEN
    RETURN jsonb_build_object('enabled', false, 'photos', '[]'::jsonb);
  END IF;
  open_ := COALESCE((cfg ->> 'slideshowLive')::boolean, false) OR (reveal IS NOT NULL AND now() >= reveal);
  IF NOT open_ THEN
    RETURN jsonb_build_object('enabled', true, 'available', false, 'photos', '[]'::jsonb);
  END IF;

  RETURN jsonb_build_object('enabled', true, 'available', true, 'photos', COALESCE((
    SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC)
    FROM (
      SELECT p.id, p.image_url, p.caption, p.created_at, s.name AS guest_name,
             (p.guest_session_id IS NOT NULL) AS from_guest
        FROM public.photos p
        LEFT JOIN public.guest_sessions s ON s.id = p.guest_session_id
       WHERE p.event_id = p_event_id
         AND ((p.guest_session_id IS NOT NULL AND p.guest_status = 'approved')
              OR (p.guest_session_id IS NULL AND p.is_published = true))
       ORDER BY p.created_at DESC
       LIMIT GREATEST(p_limit, 1)
    ) x), '[]'::jsonb));
END $$;


GRANT EXECUTE ON FUNCTION public.guest_state(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guest_join(uuid, uuid, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guest_add_photo(uuid, uuid, uuid, text, text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guest_my_photos(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guest_delete_photo(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guest_album(uuid, uuid, text, uuid, text, integer, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guest_toggle_like(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guest_slideshow(uuid, integer) TO anon, authenticated;

-- Make the new functions visible to the API right away
NOTIFY pgrst, 'reload schema';
