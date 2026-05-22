-- Add custom_links to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS custom_links JSONB NOT NULL DEFAULT '[]';

-- Testimonial submissions table for client-submitted reviews (pending operator approval)
CREATE TABLE IF NOT EXISTS public.testimonial_submissions (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id  UUID         NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    author      TEXT         NOT NULL,
    role        TEXT,
    company     TEXT,
    text        TEXT         NOT NULL,
    rating      INTEGER      CHECK (rating BETWEEN 1 AND 5),
    status      TEXT         NOT NULL DEFAULT 'pending',
    created_at  TIMESTAMPTZ  DEFAULT now()
);

ALTER TABLE public.testimonial_submissions ENABLE ROW LEVEL SECURITY;

-- Anyone can submit a review
CREATE POLICY "submissions_public_insert"
  ON public.testimonial_submissions FOR INSERT
  WITH CHECK (true);

-- Only the profile owner can read their submissions
CREATE POLICY "submissions_owner_select"
  ON public.testimonial_submissions FOR SELECT
  USING (profile_id = auth.uid());

-- Only the profile owner can update status (approve/decline)
CREATE POLICY "submissions_owner_update"
  ON public.testimonial_submissions FOR UPDATE
  USING (profile_id = auth.uid());
