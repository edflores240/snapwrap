import { notFound } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import GalleryClient, { PAGE_SIZE, PHOTO_COLUMNS, type Event, type Photo } from './GalleryClient';

// Photos are added while an event is running, so never serve a cached copy
export const dynamic = 'force-dynamic';

export default async function PublicGalleryPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;

    // Event and first page of photos load in parallel; the inner join filters photos by event slug
    const [eventRes, photosRes] = await Promise.all([
        supabase.from('events').select('*').eq('slug', slug).single(),
        supabase
            .from('photos')
            .select(`${PHOTO_COLUMNS}, events!inner(slug)`, { count: 'exact' })
            .eq('events.slug', slug)
            .eq('is_published', true)
            .order('created_at', { ascending: false })
            .range(0, PAGE_SIZE - 1),
    ]);

    if (eventRes.error || !eventRes.data) notFound();

    return (
        <GalleryClient
            initialEvent={eventRes.data as Event}
            initialPhotos={(photosRes.data as unknown as Photo[]) ?? []}
            initialTotal={photosRes.count ?? 0}
        />
    );
}
