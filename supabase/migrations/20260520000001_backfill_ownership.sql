-- Backfill user_id on pre-SaaS events and photos to the original admin account
UPDATE public.events
SET user_id = (SELECT id FROM auth.users WHERE email = 'jay@snapwrap.com')
WHERE user_id IS NULL;

UPDATE public.photos
SET user_id = (SELECT id FROM auth.users WHERE email = 'jay@snapwrap.com')
WHERE user_id IS NULL;
