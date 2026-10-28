'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import Logo from '@/components/ui/Logo';

interface PhotoData {
    id: string;
    storage_path: string;
    image_url: string;
    created_at: string;
    event_id: string;
    events?: {
        slug: string;
    } | null;
}

export default function DownloadPage() {
    const params = useParams();
    const [photo, setPhoto] = useState<PhotoData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [downloading, setDownloading] = useState(false);
    // The booth hands out this link before the photo has finished uploading, so a missing row means "not synced yet"
    const [waitingSince, setWaitingSince] = useState<number | null>(null);

    useEffect(() => {
        let cancelled = false;
        let timer: ReturnType<typeof setTimeout>;

        const poll = async () => {
            try {
                const { data, error } = await supabase
                    .from('photos')
                    .select('*, events(slug)')
                    .eq('id', params.photoId)
                    .maybeSingle();

                if (cancelled) return;
                // 22P02 = malformed id, so it will never exist
                if (error?.code === '22P02') { setError(true); setLoading(false); return; }
                if (data) { setPhoto(data); setWaitingSince(null); setLoading(false); return; }
            } catch {
                // network blip on the guest's phone: keep trying
            }
            if (cancelled) return;
            setWaitingSince(prev => prev ?? Date.now());
            setLoading(false);
            timer = setTimeout(poll, 4000);
        };

        poll();
        return () => { cancelled = true; clearTimeout(timer); };
    }, [params.photoId]);

    const handleDownload = async () => {
        if (!photo?.image_url) return;
        setDownloading(true);
        try {
            const response = await fetch(photo.image_url);
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `snapwrap-${photo.id.slice(0, 8)}.jpg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch {
            // Fallback: open in new tab
            window.open(photo.image_url, '_blank');
        } finally {
            setDownloading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-gray-400">Loading your photo...</p>
                </div>
            </div>
        );
    }

    if (!error && !photo && waitingSince) {
        const longWait = Date.now() - waitingSince > 120_000;
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white">
                <div className="text-center max-w-md px-6">
                    <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <h1 className="text-2xl font-bold mb-2">Preparing your photo…</h1>
                    <p className="text-gray-400">
                        {longWait
                            ? 'This is taking longer than usual. Keep this page open — it will update as soon as your photo arrives.'
                            : 'Hang tight, this page will update automatically.'}
                    </p>
                </div>
            </div>
        );
    }

    if (error || !photo) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white">
                <div className="text-center max-w-md px-6">
                    <div className="text-6xl mb-4">😕</div>
                    <h1 className="text-2xl font-bold mb-2">Photo Not Found</h1>
                    <p className="text-gray-400">This photo may have been removed or the link is incorrect.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-950 text-white relative overflow-hidden">
            {/* Background */}
            <div className="fixed inset-0 bg-gradient-to-br from-indigo-950/40 via-gray-950 to-purple-950/30 pointer-events-none" />

            <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-12">
                <div className="max-w-lg w-full text-center">
                    {/* Header */}
                    <div className="mb-8">
                        <Logo size={56} className="mx-auto mb-4" priority />
                        <h1 className="text-4xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
                            SnapWrap
                        </h1>
                        <p className="text-gray-400">Your photo is ready!</p>
                    </div>

                    {/* Photo preview */}
                    <div className="rounded-2xl overflow-hidden border-2 border-white/10 shadow-2xl mb-8" style={{
                        animation: 'slideUp 0.6s ease-out',
                    }}>
                        <img
                            src={photo.image_url}
                            alt="Your SnapWrap photo"
                            className="w-full h-auto"
                            style={{ maxHeight: '70vh', objectFit: 'contain' }}
                        />
                    </div>

                    {/* Download button */}
                    <button
                        onClick={handleDownload}
                        disabled={downloading}
                        className="w-full max-w-xs mx-auto px-8 py-4 text-lg font-bold rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-xl shadow-indigo-500/30 hover:shadow-2xl hover:shadow-indigo-500/40 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                    >
                        {downloading ? (
                            <span className="flex items-center justify-center gap-2">
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Downloading...
                            </span>
                        ) : (
                            '📥 Save Photo'
                        )}
                    </button>

                    {/* Timestamp */}
                    <p className="text-sm text-gray-600 mt-6 mb-8">
                        Taken {new Date(photo.created_at).toLocaleDateString('en-US', {
                            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                            hour: 'numeric', minute: '2-digit',
                        })}
                    </p>

                    {/* View Gallery Link */}
                    {photo.events?.slug && (
                        <div className="mb-6">
                            <Link
                                href={`/e/${photo.events.slug}/gallery`}
                                className="inline-block px-6 py-3 rounded-full border border-indigo-500/30 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 hover:border-indigo-500/50 transition-all"
                            >
                                📸 View Full Event Gallery
                            </Link>
                        </div>
                    )}

                    {/* Branding */}
                    <div className="mt-12 text-xs text-gray-700">
                        Powered by <span className="font-semibold text-gray-500">SnapWrap</span>
                    </div>
                </div>
            </div>

            <style jsx>{`
                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}
