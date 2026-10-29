import { notFound } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import AlbumClient from './AlbumClient';
import type { GuestEvent } from '../GuestApp';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const { data } = await supabase.from('events').select('name').eq('slug', slug).maybeSingle();
    return { title: data?.name ? `${data.name} · Album` : 'Album', robots: { index: false } };
}

export default async function AlbumPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const { data } = await supabase.from('events').select('id, name, slug, date, config').eq('slug', slug).maybeSingle();
    if (!data) notFound();
    return <AlbumClient event={data as GuestEvent} />;
}
