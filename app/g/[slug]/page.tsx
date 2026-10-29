import { notFound } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import GuestApp, { type GuestEvent } from './GuestApp';

// Settings change while the event runs, so never serve a cached copy
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const { data } = await supabase.from('events').select('name').eq('slug', slug).maybeSingle();
    return { title: data?.name ? `${data.name} · Guest camera` : 'Guest camera', robots: { index: false } };
}

export default async function GuestPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const { data, error } = await supabase
        .from('events')
        .select('id, name, slug, date, config')
        .eq('slug', slug)
        .maybeSingle();

    if (error) console.error('Guest page event query failed:', error.message);
    if (!data) notFound();

    return <GuestApp event={data as GuestEvent} />;
}
