-- ============================================================
-- SaaS Foundation: multi-tenant profiles, scoped events/photos
-- ============================================================

-- 1. Profiles table (one row per auth user / operator account)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  business_name TEXT,
  bio TEXT,
  logo_url TEXT,
  location TEXT,
  website TEXT,
  services JSONB NOT NULL DEFAULT '[]',     -- [{title, description, price, features[]}]
  social_links JSONB NOT NULL DEFAULT '{}', -- {instagram, facebook, tiktok, twitter}
  stripe_customer_id TEXT,
  subscription_status TEXT NOT NULL DEFAULT 'free', -- 'free' | 'pro' | 'business'
  subscription_period_end TIMESTAMPTZ,
  events_created_this_month INT NOT NULL DEFAULT 0,
  ai_credits_used_this_month INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Operators can read/write their own profile
CREATE POLICY "profiles_owner_all"
  ON public.profiles FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Anyone can read public profile fields (for /u/[username] page)
CREATE POLICY "profiles_public_select"
  ON public.profiles FOR SELECT
  USING (true);


-- 2. Add user_id + event_type to events
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS event_type TEXT NOT NULL DEFAULT 'booth'; -- 'booth' | 'virtual'


-- 3. Add user_id to photos
ALTER TABLE public.photos
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;


-- 4. Drop the old open RLS policies on events
DROP POLICY IF EXISTS "Public events are viewable by everyone" ON public.events;
DROP POLICY IF EXISTS "Admins can insert events" ON public.events;
DROP POLICY IF EXISTS "Admins can update events" ON public.events;
-- Also drop any delete policy if it exists
DROP POLICY IF EXISTS "Admins can delete events" ON public.events;
DROP POLICY IF EXISTS "Anyone can delete events" ON public.events;

-- Events: operators own their rows; public can SELECT active events by slug (for booth page)
CREATE POLICY "events_owner_all"
  ON public.events FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "events_public_active_select"
  ON public.events FOR SELECT
  USING (is_active = true);


-- 5. Drop old open RLS policies on photos
DROP POLICY IF EXISTS "Photos are viewable by everyone" ON public.photos;
DROP POLICY IF EXISTS "Anyone can upload photos" ON public.photos;
DROP POLICY IF EXISTS "Anyone can update photos" ON public.photos;
DROP POLICY IF EXISTS "Anyone can delete photos" ON public.photos;

-- Photos: operators own their rows; public can SELECT published photos (for galleries/download)
CREATE POLICY "photos_owner_all"
  ON public.photos FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "photos_public_published_select"
  ON public.photos FOR SELECT
  USING (is_published = true);

-- Guest capture: allow anonymous inserts (guests take photos without accounts)
CREATE POLICY "photos_guest_insert"
  ON public.photos FOR INSERT
  WITH CHECK (true);


-- 6. Indexes for common query patterns
CREATE INDEX IF NOT EXISTS events_user_id_idx ON public.events(user_id);
CREATE INDEX IF NOT EXISTS events_slug_idx ON public.events(slug);
CREATE INDEX IF NOT EXISTS photos_event_id_idx ON public.photos(event_id);
CREATE INDEX IF NOT EXISTS photos_user_id_idx ON public.photos(user_id);
CREATE INDEX IF NOT EXISTS profiles_username_idx ON public.profiles(username);
