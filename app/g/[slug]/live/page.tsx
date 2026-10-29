import { notFound } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import LiveClient from './LiveClient';
import type { GuestEvent } from '../GuestApp';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Live slideshow', robots: { index: false } };

export default async function LivePage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const { data } = await supabase.from('events').select('id, name, slug, date, config').eq('slug', slug).maybeSingle();
    if (!data) notFound();
    return <LiveClient event={data as GuestEvent} />;
}
