-- Migration: Add missing columns to events table for template support

-- 1. Add 'slug' column if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'slug') THEN
        ALTER TABLE public.events ADD COLUMN slug text UNIQUE;
    END IF;
END $$;

-- 2. Add 'config' JSONB column if not exists (stores templates, settings, etc.)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'events' AND column_name = 'config') THEN
        ALTER TABLE public.events ADD COLUMN config jsonb DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- 3. Update RLS policies to allow anon users to update events
DROP POLICY IF EXISTS "Admins can update events" ON public.events;
DROP POLICY IF EXISTS "Anyone can update events" ON public.events;

CREATE POLICY "Anyone can update events"
    ON public.events FOR UPDATE
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can insert events" ON public.events;
DROP POLICY IF EXISTS "Anyone can insert events" ON public.events;

CREATE POLICY "Anyone can insert events"
    ON public.events FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can delete events" ON public.events;

CREATE POLICY "Anyone can delete events"
    ON public.events FOR DELETE
    USING (true);
