-- Migration: Add missing columns to events table for template support
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor > New query)

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

-- 3. Update RLS policies to allow anon users to update events (for admin use with anon key)
-- Drop old restrictive policy if it exists
DROP POLICY IF EXISTS "Admins can update events" ON public.events;

-- Create permissive update policy
CREATE POLICY "Anyone can update events"
    ON public.events FOR UPDATE
    USING (true)
    WITH CHECK (true);

-- Also allow inserts from anon
DROP POLICY IF EXISTS "Admins can insert events" ON public.events;

CREATE POLICY "Anyone can insert events"
    ON public.events FOR INSERT
    WITH CHECK (true);

-- Also allow deletes
DROP POLICY IF EXISTS "Anyone can delete events" ON public.events;

CREATE POLICY "Anyone can delete events"
    ON public.events FOR DELETE
    USING (true);
