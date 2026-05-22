import { notFound } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { Camera } from 'lucide-react';
import Link from 'next/link';
import { deriveTheme } from '@/lib/color-utils';
import { getContrastColor } from '@/lib/color-utils';
import ReviewForm from './ReviewForm';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Props {
    params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: Props) {
    const { username } = await params;
    const { data } = await supabase.from('profiles').select('business_name, username').eq('username', username).single();
    if (!data) return { title: 'Not Found' };
    return { title: `Leave a Review — ${data.business_name || data.username}` };
}

export default async function ReviewPage({ params }: Props) {
    const { username } = await params;
    const { data: profile } = await supabase
        .from('profiles')
        .select('id, username, business_name, accent_color, dark_mode')
        .eq('username', username)
        .single();

    if (!profile) notFound();

    const accent = profile.accent_color || '#171717';
    const darkMode = profile.dark_mode ?? false;
    const t = deriveTheme(accent, darkMode);
    const accentContrast = getContrastColor(accent);
    const name = profile.business_name || profile.username;

    return (
        <div className="min-h-screen" style={{ backgroundColor: t.bg, color: t.text }}>
            {/* Navbar */}
            <nav className="sticky top-0 z-40 flex items-center justify-between px-4 md:px-10 py-4 backdrop-blur-xl border-b"
                style={{ backgroundColor: `${t.bg}e6`, borderColor: t.border }}>
                <Link href={`/u/${username}`} className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: accent }}>
                        <Camera size={13} style={{ color: accentContrast }} />
                    </div>
                    <span className="text-sm font-bold" style={{ color: t.text }}>{name}</span>
                </Link>
            </nav>

            <main className="max-w-md mx-auto px-4 py-16">
                {/* Header */}
                <div className="text-center mb-10">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                        style={{ backgroundColor: accent }}>
                        <span className="text-2xl font-black" style={{ color: accentContrast }}>
                            {name.charAt(0).toUpperCase()}
                        </span>
                    </div>
                    <h1 className="text-2xl font-black mb-2" style={{ color: t.text }}>
                        Leave a Review
                    </h1>
                    <p className="text-sm" style={{ color: t.muted }}>
                        Share your experience with <strong style={{ color: t.text }}>{name}</strong>
                    </p>
                </div>

                {/* Form card */}
                <div className="rounded-3xl p-6 md:p-8 border shadow-lg" style={{ backgroundColor: t.surface, borderColor: t.border }}>
                    <ReviewForm
                        profileId={profile.id}
                        businessName={name}
                        accent={accent}
                        accentContrast={accentContrast}
                        t={t}
                    />
                </div>

                <p className="text-center text-xs mt-8" style={{ color: t.muted }}>
                    Powered by <Link href="/" className="font-bold hover:underline" style={{ color: t.text }}>SnapWrap</Link>
                </p>
            </main>
        </div>
    );
}
