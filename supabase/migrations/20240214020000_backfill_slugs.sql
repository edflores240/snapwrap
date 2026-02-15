-- Backfill: set slug for any events that have NULL slug
UPDATE public.events
SET slug = LOWER(REGEXP_REPLACE(name, '[^a-zA-Z0-9]+', '-', 'g'))
WHERE slug IS NULL;
