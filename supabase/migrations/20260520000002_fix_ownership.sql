-- Re-assign all events and photos to the correct owner UUID
UPDATE public.events
SET user_id = '229d97cc-887b-4828-be97-eaf828c849dc';

UPDATE public.photos
SET user_id = '229d97cc-887b-4828-be97-eaf828c849dc';
