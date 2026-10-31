-- ============================================================
-- Guest album: fast paging at scale, and race-proof hearts
--
-- Measured with 60,000 approved photos: every album page sorted the whole album and rebuilt the guest and
-- moment filter lists, so 150 guests paging at once waited ~2.4 s each. Now the sort uses an index and the
-- filter lists are only built for the first page (the app keeps them from there).
-- ============================================================

CREATE INDEX IF NOT EXISTS photos_album_new_idx   ON public.photos (event_id, created_at DESC)              WHERE guest_status = 'approved';
CREATE INDEX IF NOT EXISTS photos_album_loved_idx ON public.photos (event_id, like_count DESC, created_at DESC) WHERE guest_status = 'approved';


CREATE OR REPLACE FUNCTION public.guest_album(
  p_event_id uuid, p_visitor_id uuid, p_sort text, p_guest uuid, p_prompt text, p_limit integer, p_offset integer
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cfg    jsonb := public.guest_cfg(p_event_id);
  reveal timestamptz := NULLIF(public.guest_cfg(p_event_id) ->> 'revealAt', '')::timestamptz;
  total  integer;
  rows_  jsonb;
  facets jsonb := NULL;
  lim    integer := LEAST(GREATEST(p_limit, 1), 200);
  off_   integer := GREATEST(p_offset, 0);
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

  -- Two branches so each can use its own index (a CASE in ORDER BY would force a full sort)
  IF p_sort = 'loved' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(y) - 'rn' ORDER BY y.rn), '[]'::jsonb) INTO rows_
    FROM (
      SELECT row_number() OVER () AS rn, x.* FROM (
        SELECT p.id, p.image_url, p.thumb_url, p.caption, p.prompt, p.like_count, p.created_at, s.name AS guest_name,
               EXISTS (SELECT 1 FROM public.photo_likes l WHERE l.photo_id = p.id AND l.visitor_id = p_visitor_id) AS liked
          FROM public.photos p LEFT JOIN public.guest_sessions s ON s.id = p.guest_session_id
         WHERE p.event_id = p_event_id AND p.guest_status = 'approved'
           AND (p_guest IS NULL OR p.guest_session_id = p_guest) AND (p_prompt IS NULL OR p.prompt = p_prompt)
         ORDER BY p.like_count DESC, p.created_at DESC
         LIMIT lim OFFSET off_
      ) x
    ) y;
  ELSE
    SELECT COALESCE(jsonb_agg(to_jsonb(y) - 'rn' ORDER BY y.rn), '[]'::jsonb) INTO rows_
    FROM (
      SELECT row_number() OVER () AS rn, x.* FROM (
        SELECT p.id, p.image_url, p.thumb_url, p.caption, p.prompt, p.like_count, p.created_at, s.name AS guest_name,
               EXISTS (SELECT 1 FROM public.photo_likes l WHERE l.photo_id = p.id AND l.visitor_id = p_visitor_id) AS liked
          FROM public.photos p LEFT JOIN public.guest_sessions s ON s.id = p.guest_session_id
         WHERE p.event_id = p_event_id AND p.guest_status = 'approved'
           AND (p_guest IS NULL OR p.guest_session_id = p_guest) AND (p_prompt IS NULL OR p.prompt = p_prompt)
         ORDER BY p.created_at DESC
         LIMIT lim OFFSET off_
      ) x
    ) y;
  END IF;

  -- The filter lists are only needed once, with the first page
  IF off_ = 0 THEN
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
  END IF;

  RETURN jsonb_build_object('enabled', true, 'revealed', true, 'total', total, 'photos', rows_)
         || CASE WHEN facets IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('facets', facets) END;
END $$;


-- Hearts: lock the photo first so two people hearting it at the same instant can't store a stale count
CREATE OR REPLACE FUNCTION public.guest_toggle_like(p_photo_id uuid, p_visitor_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ev     uuid;
  reveal timestamptz;
  was_liked boolean;
  cnt    integer;
BEGIN
  SELECT event_id INTO ev FROM public.photos WHERE id = p_photo_id AND guest_status = 'approved' FOR UPDATE;
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


GRANT EXECUTE ON FUNCTION public.guest_album(uuid, uuid, text, uuid, text, integer, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guest_toggle_like(uuid, uuid) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
