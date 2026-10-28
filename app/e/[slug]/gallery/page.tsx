import { notFound } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { CAROUSEL_MAX_PHOTOS as MAX_GALLERY_PHOTOS, CAROUSEL_PHOTO_COLUMNS as GALLERY_COLUMNS } from '@/lib/gallery-queries';
import GalleryClient, { type Event, type Photo } from './GalleryClient';

// Photos are added while an event is running, so never serve a cached copy
export const dynamic = 'force-dynamic';

export default async function EventGalleryPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;

    // Event and photos load in parallel; the inner join filters photos by event slug
    const [eventRes, photosRes] = await Promise.all([
        supabase.from('events').select('*').eq('slug', slug).single(),
        supabase
            .from('photos')
            .select(`${GALLERY_COLUMNS}, events!inner(slug)`)
            .eq('events.slug', slug)
            .eq('is_published', true)
            .order('created_at', { ascending: false })
            .limit(MAX_GALLERY_PHOTOS),
    ]);

    if (photosRes.error) console.error('Gallery photos query failed:', photosRes.error.message);
    if (eventRes.error || !eventRes.data) notFound();

    return (
        <GalleryClient
            initialEvent={eventRes.data as Event}
            initialPhotos={(photosRes.data as unknown as Photo[]) ?? []}
        />
    );
}
