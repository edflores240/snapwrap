'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Heart, Download, X, ChevronLeft, ChevronRight, Loader2, Archive } from 'lucide-react';
import { getAlbum, getVisitorId, readGuestConfig, toggleLike, type AlbumPhoto, type AlbumResult } from '@/lib/guest-camera';
import type { GuestEvent } from '../GuestApp';
import LockedAlbum from './LockedAlbum';

const PAGE = 36;
const SERIF = '"Playfair Display", Georgia, serif';

export default function AlbumClient({ event }: { event: GuestEvent }) {
    const cfg = useMemo(() => readGuestConfig((event.config as { guestCamera?: unknown } | null)?.guestCamera), [event.config]);
    const accent = ((event.config as { boothSettings?: { themeColor?: string } } | null)?.boothSettings?.themeColor) || '#2A2724';

    const [visitorId, setVisitorId] = useState<string | null>(null);
    const [first, setFirst] = useState<AlbumResult | null>(null);
    const [photos, setPhotos] = useState<AlbumPhoto[]>([]);
    const [total, setTotal] = useState(0);
    const [sort, setSort] = useState<'new' | 'loved'>('new');
    const [guest, setGuest] = useState<string | null>(null);
    const [prompt, setPrompt] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lightbox, setLightbox] = useState<number | null>(null);
    const [now, setNow] = useState(() => Date.now());
    const [skew, setSkew] = useState(0);
    const [zip, setZip] = useState<{ done: number; total: number } | null>(null);
    const [top, setTop] = useState<AlbumPhoto[]>([]);

    useEffect(() => { setVisitorId(getVisitorId()); }, []);

    const load = useCallback(async (reset: boolean, offset = 0) => {
        if (!visitorId) return;
        if (reset) setLoading(true); else setLoadingMore(true);
        try {
            const res = await getAlbum(event.id, visitorId, { sort, guest, prompt, limit: PAGE, offset });
            if (res.now) setSkew(new Date(res.now).getTime() - Date.now());
            if (reset) setFirst(res);
            else setFirst(prev => prev ?? res);
            setTotal(res.total ?? 0);
            setPhotos(prev => reset ? (res.photos ?? []) : [...prev, ...(res.photos ?? []).filter(p => !prev.some(x => x.id === p.id))]);
            setError(null);
        } catch (err) {
            console.error('Album failed to load:', (err as Error).message);
            setError('We couldn\'t load the album. Check your connection and try again.');
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [event.id, visitorId, sort, guest, prompt]);

    useEffect(() => { void load(true); }, [load]);

    // The "most loved" strip is its own query so it ignores the current filters
    useEffect(() => {
        if (!visitorId || !first?.revealed) return;
        getAlbum(event.id, visitorId, { sort: 'loved', guest: null, prompt: null, limit: 6, offset: 0 })
            .then(r => setTop((r.photos ?? []).filter(p => p.like_count > 0)))
            .catch(() => undefined);
    }, [event.id, visitorId, first?.revealed, photos.length]);

    useEffect(() => {
        const t = setInterval(() => setNow(Date.now() + skew), 1000);
        return () => clearInterval(t);
    }, [skew]);

    // Auto-open the album once the reveal time passes
    const revealAtMs = first?.revealAt ? new Date(first.revealAt).getTime() : null;
    useEffect(() => {
        if (first && !first.revealed && revealAtMs && now >= revealAtMs) void load(true);
    }, [first, revealAtMs, now, load]);

    const heart = async (photo: AlbumPhoto) => {
        if (!visitorId) return;
        const apply = (liked: boolean, count: number) => {
            const patch = (p: AlbumPhoto) => (p.id === photo.id ? { ...p, liked, like_count: count } : p);
            setPhotos(prev => prev.map(patch));
            setTop(prev => prev.map(patch));
        };
        // Optimistic, then settle on the server's count
        apply(!photo.liked, Math.max(0, photo.like_count + (photo.liked ? -1 : 1)));
        try {
            const res = await toggleLike(photo.id, visitorId);
            apply(res.liked, res.like_count);
        } catch {
            apply(photo.liked, photo.like_count);
        }
    };

    const downloadOne = async (photo: AlbumPhoto) => {
        try {
            const blob = await (await fetch(photo.image_url)).blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `${event.slug}-${photo.id.slice(0, 8)}.jpg`;
            document.body.appendChild(a); a.click(); a.remove();
            URL.revokeObjectURL(url);
        } catch { window.open(photo.image_url, '_blank'); }
    };

    const downloadAll = async () => {
        if (!visitorId || zip) return;
        const JSZip = (await import('jszip')).default;
        const archive = new JSZip();
        setZip({ done: 0, total });
        try {
            // Fetch every page so the ZIP has the whole album, not just what's on screen
            const all: AlbumPhoto[] = [];
            for (let offset = 0; offset < total; offset += 100) {
                const res = await getAlbum(event.id, visitorId, { sort: 'new', guest: null, prompt: null, limit: 100, offset });
                all.push(...(res.photos ?? []));
            }
            let done = 0;
            for (const p of all) {
                try {
                    const blob = await (await fetch(p.image_url)).blob();
                    archive.file(`${String(done + 1).padStart(3, '0')}-${(p.guest_name || 'guest').replace(/[^\w-]+/g, '_')}.jpg`, blob);
                } catch { /* skip a file that can't be fetched */ }
                setZip({ done: ++done, total: all.length });
            }
            const out = await archive.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(out);
            const a = document.createElement('a');
            a.href = url; a.download = `${event.slug}-album.zip`;
            document.body.appendChild(a); a.click(); a.remove();
            URL.revokeObjectURL(url);
        } finally {
            setZip(null);
        }
    };

    // Keyboard navigation in the lightbox
    useEffect(() => {
        if (lightbox === null) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setLightbox(null);
            if (e.key === 'ArrowRight') setLightbox(i => (i === null ? null : Math.min(photos.length - 1, i + 1)));
            if (e.key === 'ArrowLeft') setLightbox(i => (i === null ? null : Math.max(0, i - 1)));
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [lightbox, photos.length]);

    const frame = (children: React.ReactNode) => (
        <main className="min-h-[100dvh] text-[#2A2724]" style={{ background: 'linear-gradient(180deg,#FBF8F3 0%,#F3EEE6 100%)' }}>
            <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-[max(28px,env(safe-area-inset-top))] pb-24">
                <header className="text-center mb-10">
                    <p className="text-[10px] font-bold uppercase tracking-[0.35em] opacity-40 mb-3">The album</p>
                    <h1 className="text-4xl sm:text-5xl leading-tight" style={{ fontFamily: SERIF }}>{cfg.welcomeTitle || event.name}</h1>
                </header>
                {children}
                <p className="text-center text-[10px] uppercase tracking-[0.3em] opacity-30 mt-16">Powered by SnapWrap</p>
            </div>
        </main>
    );

    if (loading && !first) return frame(<div className="flex justify-center py-20 opacity-40"><Loader2 className="animate-spin" /></div>);
    if (error && !first) return frame(<p className="text-center text-sm opacity-70">{error}</p>);
    if (!first?.enabled) return frame(<p className="text-center text-sm opacity-70">This album isn&apos;t available.</p>);

    if (!first.revealed) {
        return (
            <LockedAlbum
                title={cfg.welcomeTitle || event.name}
                accent={accent}
                slug={event.slug}
                revealAtMs={revealAtMs}
                now={now}
                total={first.total ?? 0}
                teaser={first.teaser ?? []}
                unlocking={!!revealAtMs && now >= revealAtMs}
            />
        );
    }

    const facets = first.facets;
    const lb = lightbox !== null ? photos[lightbox] : null;

    return frame(
        <>
            {/* Controls */}
            <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
                <div className="flex rounded-full bg-white/80 border border-black/5 p-1">
                    {(['new', 'loved'] as const).map(s => (
                        <button key={s} onClick={() => setSort(s)} className={`px-4 py-1.5 rounded-full text-xs font-bold ${sort === s ? 'text-white' : 'opacity-60'}`} style={sort === s ? { background: accent } : undefined}>
                            {s === 'new' ? 'Newest' : 'Most loved'}
                        </button>
                    ))}
                </div>
                {facets && facets.guests.length > 1 && (
                    <select value={guest ?? ''} onChange={e => setGuest(e.target.value || null)} className="rounded-full bg-white/80 border border-black/5 px-4 py-2 text-xs font-bold">
                        <option value="">All guests</option>
                        {facets.guests.map(g => <option key={g.id} value={g.id}>{g.name} ({g.count})</option>)}
                    </select>
                )}
                {facets && facets.prompts.length > 0 && (
                    <select value={prompt ?? ''} onChange={e => setPrompt(e.target.value || null)} className="rounded-full bg-white/80 border border-black/5 px-4 py-2 text-xs font-bold max-w-[200px]">
                        <option value="">All moments</option>
                        {facets.prompts.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                )}
                <button
                    onClick={downloadAll}
                    disabled={!!zip || total === 0}
                    className="rounded-full px-4 py-2 text-xs font-bold text-white flex items-center gap-2 disabled:opacity-60"
                    style={{ background: accent }}
                >
                    {zip ? <><Loader2 size={13} className="animate-spin" /> {zip.done}/{zip.total}</> : <><Archive size={13} /> Download all</>}
                </button>
            </div>

            {/* Most loved */}
            {top.length > 0 && sort === 'new' && !guest && !prompt && (
                <section className="mb-10">
                    <h2 className="text-xl mb-3 flex items-center gap-2" style={{ fontFamily: SERIF }}><Heart size={16} fill={accent} stroke="none" /> Most loved</h2>
                    <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
                        {top.map(p => (
                            <button key={p.id} onClick={() => { const i = photos.findIndex(x => x.id === p.id); if (i >= 0) setLightbox(i); else window.open(p.image_url, '_blank'); }}
                                className="relative shrink-0 w-36 aspect-[3/4] rounded-2xl overflow-hidden shadow-sm">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={p.thumb_url || p.image_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                                <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full bg-black/60 text-white text-[11px] font-bold flex items-center gap-1"><Heart size={10} fill="#fff" stroke="none" /> {p.like_count}</span>
                            </button>
                        ))}
                    </div>
                </section>
            )}

            {photos.length === 0 ? (
                <p className="text-center text-sm opacity-60 py-16">{loading ? 'Loading…' : 'No photos here yet.'}</p>
            ) : (
                <div className="columns-2 sm:columns-3 lg:columns-4 gap-3">
                    {photos.map((p, i) => (
                        <figure key={p.id} className="relative mb-3 break-inside-avoid rounded-2xl overflow-hidden bg-black/5 shadow-sm group">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={p.thumb_url || p.image_url} alt={p.caption || ''} loading="lazy" className="w-full block cursor-zoom-in" onClick={() => setLightbox(i)} />
                            <button
                                onClick={() => heart(p)}
                                className="absolute bottom-2 right-2 px-2.5 py-1.5 rounded-full bg-black/55 backdrop-blur text-white text-xs font-bold flex items-center gap-1.5"
                                aria-label={p.liked ? 'Remove heart' : 'Heart'}
                            >
                                <Heart size={14} fill={p.liked ? '#ff4d6d' : 'none'} stroke={p.liked ? '#ff4d6d' : '#fff'} />
                                {p.like_count > 0 && p.like_count}
                            </button>
                            {(p.guest_name || p.caption) && (
                                <figcaption className="absolute inset-x-0 bottom-0 p-3 pr-16 text-white text-[11px] bg-gradient-to-t from-black/60 to-transparent pointer-events-none">
                                    {p.caption && <div className="font-semibold leading-snug">{p.caption}</div>}
                                    {p.guest_name && <div className="opacity-70">{p.guest_name}</div>}
                                </figcaption>
                            )}
                        </figure>
                    ))}
                </div>
            )}

            {photos.length < total && (
                <div className="flex justify-center mt-8">
                    <button onClick={() => load(false, photos.length)} disabled={loadingMore} className="px-8 py-3 rounded-full border border-black/15 text-xs font-bold uppercase tracking-widest bg-white/70 disabled:opacity-50">
                        {loadingMore ? 'Loading…' : `Load more (${total - photos.length})`}
                    </button>
                </div>
            )}

            {lb && lightbox !== null && (
                <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4" onClick={() => setLightbox(null)}>
                    <button className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/10 text-white flex items-center justify-center" aria-label="Close"><X size={20} /></button>
                    {lightbox > 0 && <button onClick={e => { e.stopPropagation(); setLightbox(lightbox - 1); }} className="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 text-white flex items-center justify-center" aria-label="Previous"><ChevronLeft size={22} /></button>}
                    {lightbox < photos.length - 1 && <button onClick={e => { e.stopPropagation(); setLightbox(lightbox + 1); }} className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 text-white flex items-center justify-center" aria-label="Next"><ChevronRight size={22} /></button>}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={lb.image_url} alt={lb.caption || ''} className="max-h-[78dvh] max-w-full object-contain rounded-xl" onClick={e => e.stopPropagation()} />
                    <div className="mt-4 text-center text-white" onClick={e => e.stopPropagation()}>
                        {lb.caption && <p className="text-sm font-semibold">{lb.caption}</p>}
                        {lb.guest_name && <p className="text-xs opacity-60">{lb.guest_name}</p>}
                        <div className="flex justify-center gap-3 mt-3">
                            <button onClick={() => heart(lb)} className="px-5 py-2.5 rounded-full bg-white/10 text-sm font-bold flex items-center gap-2">
                                <Heart size={16} fill={lb.liked ? '#ff4d6d' : 'none'} stroke={lb.liked ? '#ff4d6d' : '#fff'} /> {lb.like_count || 'Heart'}
                            </button>
                            <button onClick={() => downloadOne(lb)} className="px-5 py-2.5 rounded-full bg-white text-black text-sm font-bold flex items-center gap-2"><Download size={16} /> Save</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
