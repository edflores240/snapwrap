-- ============================================================
-- Guest camera: make the shot limit race-proof
--
-- guest_add_photo checked "shots used < limit" and inserted in separate steps, so several uploads from
-- one phone arriving at the same moment could all pass the check. It now locks the guest's row first.
-- ============================================================

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
  found_ boolean;
BEGIN
  -- Lock this guest's row first: uploads from one phone arriving together then take turns, so the
  -- shot count below can't be read by two of them at once (which let a guest exceed the limit).
  SELECT * INTO sess FROM public.guest_sessions WHERE id = p_session_id AND event_id = p_event_id FOR UPDATE;
  found_ := FOUND;

  st := public.guest_state(p_event_id, p_session_id);
  IF NOT COALESCE((st ->> 'enabled')::boolean, false) THEN RAISE EXCEPTION 'guest_disabled'; END IF;
  IF NOT found_ THEN RAISE EXCEPTION 'guest_unknown'; END IF;
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




GRANT EXECUTE ON FUNCTION public.guest_add_photo(uuid, uuid, uuid, text, text, text, text, text, text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
