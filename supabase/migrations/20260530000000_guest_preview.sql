-- ============================================================
-- Guest camera: tiny blurred previews for the locked album
--
-- Each guest photo gets a ~24px preview (a few hundred bytes), made on the phone when the photo is
-- taken. While the album is locked, only these previews are shared (never the real photos), and
-- the lock screen blurs them further. Hosts can turn it off with config.guestCamera.showTeaser = false.
-- ============================================================

ALTER TABLE public.photos ADD COLUMN IF NOT EXISTS preview text;

DROP FUNCTION IF EXISTS public.guest_add_photo(uuid, uuid, uuid, text, text, text, text, text);

-- Saves one uploaded photo, if the guest still has shots left and the camera is open
CREATE OR REPLACE FUNCTION public.guest_add_photo(
  p_event_id uuid, p_session_id uuid, p_photo_id uuid,
  p_image_url text, p_thumb_url text, p_storage_path text,
  p_caption text, p_prompt text, p_preview text DEFAULT NULL
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

  INSERT INTO public.photos (id, event_id, storage_path, image_url, thumb_url, is_published, guest_session_id, guest_status, caption, prompt, preview)
  VALUES (p_photo_id, p_event_id, p_storage_path, p_image_url, p_thumb_url, false, p_session_id, status_,
          NULLIF(left(btrim(p_caption), 200), ''), NULLIF(left(btrim(p_prompt), 120), ''),
          CASE WHEN p_preview LIKE 'data:image/jpeg;base64,%' AND length(p_preview) < 4000 THEN p_preview END);

  UPDATE public.guest_sessions SET last_seen_at = now() WHERE id = p_session_id;
  RETURN public.guest_state(p_event_id, p_session_id);
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
    -- Locked: share only how many photos are waiting and a few ~24px previews to blur on the lock screen
    RETURN jsonb_build_object(
      'enabled', true, 'revealed', false, 'revealAt', reveal, 'now', now(),
      'total', (SELECT count(*) FROM public.photos p WHERE p.event_id = p_event_id AND p.guest_status = 'approved'),
      'teaser', CASE WHEN COALESCE((cfg ->> 'showTeaser')::boolean, true) THEN COALESCE((
          SELECT jsonb_agg(t.preview) FROM (
            SELECT p.preview FROM public.photos p
             WHERE p.event_id = p_event_id AND p.guest_status = 'approved' AND p.preview IS NOT NULL
             ORDER BY p.created_at DESC LIMIT 18) t), '[]'::jsonb)
        ELSE '[]'::jsonb END);
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



GRANT EXECUTE ON FUNCTION public.guest_add_photo(uuid, uuid, uuid, text, text, text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guest_album(uuid, uuid, text, uuid, text, integer, integer) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
