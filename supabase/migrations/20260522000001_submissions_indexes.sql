-- Indexes for testimonial_submissions to speed up pending counts and list queries
CREATE INDEX IF NOT EXISTS testimonial_submissions_profile_id_status_idx 
  ON public.testimonial_submissions (profile_id, status);

CREATE INDEX IF NOT EXISTS testimonial_submissions_profile_id_status_created_at_idx 
  ON public.testimonial_submissions (profile_id, status, created_at DESC);

-- Composite index on photos for fast lookup of the latest published photo in an event
CREATE INDEX IF NOT EXISTS photos_event_id_is_published_created_at_idx 
  ON public.photos (event_id, is_published, created_at DESC);
