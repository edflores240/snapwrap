'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { Archive, Camera, Check, Download, Heart, Loader2, SlidersHorizontal, X } from 'lucide-react';
import { getAlbum, getVisitorId, readGuestConfig, toggleLike, type AlbumPhoto, type AlbumResult } from '@/lib/guest-camera';
import { contrastOn, resolveEventTheme } from '@/lib/event-theme';
import { eventBodyClass, eventTitleClass, eventTitleSize, caveat } from '@/lib/gallery-typography';
import { patternStyle } from '@/lib/gallery-effects';
import AmbientMotion from '@/components/gallery/AmbientMotion';
import ImageViewer, { viewerButton, viewerButtonPrimary } from '@/components/ui/ImageViewer';
import type { GuestEvent } from '../GuestApp';
import LockedAlbum from './LockedAlbum';

const PAGE = 36;
const CORNERS: Record<string, number> = { sharp: 0, soft: 14, round: 28 };

export default function AlbumClient({ event }: { event: GuestEvent }) {
    const cfg = useMemo(() => readGuestConfig((event.config as { guestCamera?: unknown } | null)?.guestCamera), [event.config]);
    const theme = useMemo(() => resolveEventTheme(event.config), [event.config]);
    const { primary, secondary } = theme;
    const pp = (event.config as { publicPage?: Record<string, string> } | null)?.publicPage ?? {};
    const title = cfg.welcomeTitle || pp.title || event.name;
    const radius = CORNERS[pp.corners] ?? 22;
    const onPrimary = contrastOn(primary);

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
    const [viewer, setViewer] = useState<number | null>(null);
    const [filterOpen, setFilterOpen] = useState(false);
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
            if (reset) setFirst(res); else setFirst(prev => prev ?? res);
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

    // Open the album by itself once the reveal time passes
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
        apply(!photo.liked, Math.max(0, photo.like_count + (photo.liked ? -1 : 1)));
        try {
            const res = await toggleLike(photo.id, visitorId);
            apply(res.liked, res.like_count);
        } catch {
            apply(photo.liked, photo.like_count);
        }
    };

    const saveOne = async (photo: { id: string; src: string }) => {
        try {
            const blob = await (await fetch(photo.src)).blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `${event.slug}-${photo.id.slice(0, 8)}.jpg`;
            document.body.appendChild(a); a.click(); a.remove();
            URL.revokeObjectURL(url);
        } catch { window.open(photo.src, '_blank'); }
    };

    const downloadAll = async () => {
        if (!visitorId || zip) return;
        const JSZip = (await import('jszip')).default;
        const archive = new JSZip();
        setZip({ done: 0, total });
        try {
            // Every page, so the ZIP holds the whole album and not just what's on screen
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

    if (loading && !first) {
        return <div className="min-h-[100dvh] flex items-center justify-center" style={{ background: secondary, color: primary }}><Loader2 className="animate-spin opacity-40" /></div>;
    }
    if (error && !first) {
        return <div className="min-h-[100dvh] flex items-center justify-center p-8 text-center text-sm" style={{ background: secondary, color: primary }}>{error}</div>;
    }
    if (!first?.enabled) {
        return <div className="min-h-[100dvh] flex items-center justify-center p-8 text-center text-sm" style={{ background: secondary, color: primary }}>This album isn&apos;t available.</div>;
    }

    if (!first.revealed) {
        return (
            <LockedAlbum
                title={title}
                primary={primary}
                secondary={secondary}
                config={event.config}
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
    const filtersOn = (guest ? 1 : 0) + (prompt ? 1 : 0);
    const hearts = photos.reduce((n, p) => n + p.like_count, 0);
    const pattern = patternStyle(pp.bgPattern, primary, pp.patternStrength);
    const bodyClass = eventBodyClass(event.config);
    const dockBtn = 'h-11 min-w-11 px-3.5 rounded-full flex items-center justify-center gap-2 text-xs font-bold transition-colors';

    return (
        <main className={`min-h-[100dvh] relative overflow-x-hidden ${bodyClass}`} style={{ background: secondary, color: primary }}>
            {pattern && <div className="absolute inset-0 pointer-events-none" style={{ ...pattern, zIndex: 0 }} aria-hidden />}
            {pp.bgMotion && pp.bgMotion !== 'none' && pp.bgMotion !== 'drift' && <AmbientMotion kind={pp.bgMotion} primary={primary} secondary={secondary} />}

            <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pt-[max(40px,env(safe-area-inset-top))] pb-40">
                {/* Header */}
                <header className="text-center max-w-3xl mx-auto mb-12">
                    {event.date && (
                        <div className="inline-block px-4 py-1 rounded-full text-xs font-medium mb-5 -rotate-1 shadow-sm" style={{ background: primary, color: onPrimary }}>
                            {new Date(event.date).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                        </div>
                    )}
                    <h1
                        className={`font-black tracking-tighter leading-[0.95] break-words ${eventTitleClass(event.config)}`}
                        style={{ fontSize: eventTitleSize(event.config, title), overflowWrap: 'anywhere' }}
                    >
                        {title}
                    </h1>
                    <p className="mt-5 text-base md:text-lg opacity-70">
                        {total.toLocaleString()} {total === 1 ? 'moment' : 'moments'} from the guests{hearts > 0 ? ` · ${hearts.toLocaleString()} ♥` : ''}
                    </p>
                    <p className={`${caveat.className} text-2xl mt-3 opacity-80 -rotate-2`}>{pp.handwrittenNote || 'Made by the people you love'}</p>
                </header>

                {/* Most loved */}
                {top.length > 0 && sort === 'new' && !guest && !prompt && (
                    <section className="mb-12">
                        <h2 className="text-xs font-bold uppercase tracking-[0.3em] opacity-60 mb-4 flex items-center gap-2"><Heart size={13} fill={primary} stroke="none" /> Most loved</h2>
                        <div className="flex gap-4 overflow-x-auto pb-3 -mx-4 px-4 snap-x" style={{ scrollbarWidth: 'none' }}>
                            {top.map(p => (
                                <button
                                    key={p.id}
                                    onClick={() => { const i = photos.findIndex(x => x.id === p.id); if (i >= 0) setViewer(i); }}
                                    className="relative shrink-0 w-40 sm:w-48 aspect-[3/4] overflow-hidden shadow-lg snap-start"
                                    style={{ borderRadius: radius }}
                                >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={p.thumb_url || p.image_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                                    <span className="absolute bottom-2.5 left-2.5 px-2.5 py-1 rounded-full bg-black/55 backdrop-blur text-white text-[11px] font-bold flex items-center gap-1.5"><Heart size={11} fill="#fff" stroke="none" /> {p.like_count}</span>
                                </button>
                            ))}
                        </div>
                    </section>
                )}

                {/* Grid */}
                {photos.length === 0 ? (
                    <p className="text-center text-sm opacity-60 py-20">{loading ? 'Loading…' : filtersOn ? 'Nothing matches these filters.' : 'No photos here yet.'}</p>
                ) : (
                    <div className="columns-2 md:columns-3 lg:columns-4 gap-3 sm:gap-4">
                        {photos.map((p, i) => (
                            <motion.figure
                                key={p.id}
                                initial={{ opacity: 0, y: 18 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, margin: '0px 0px -40px 0px' }}
                                transition={{ duration: 0.45, delay: (i % 6) * 0.04 }}
                                whileHover={{ y: -4 }}
                                className="relative mb-3 sm:mb-4 break-inside-avoid overflow-hidden shadow-md bg-black/5 group"
                                style={{ borderRadius: radius }}
                            >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={p.thumb_url || p.image_url} alt={p.caption || ''} loading="lazy" className="w-full block cursor-zoom-in" onClick={() => setViewer(i)} />
                                {(p.guest_name || p.caption) && (
                                    <figcaption className="absolute inset-x-0 bottom-0 p-3 pr-16 text-white text-[11px] bg-gradient-to-t from-black/65 to-transparent pointer-events-none">
                                        {p.caption && <div className="font-semibold leading-snug line-clamp-2">{p.caption}</div>}
                                        {p.guest_name && <div className="opacity-70">{p.guest_name}</div>}
                                    </figcaption>
                                )}
                                <button
                                    onClick={() => heart(p)}
                                    className="absolute bottom-2.5 right-2.5 h-9 min-w-9 px-2.5 rounded-full bg-black/45 hover:bg-black/60 backdrop-blur text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                                    aria-label={p.liked ? 'Remove heart' : 'Heart'}
                                >
                                    <motion.span key={String(p.liked)} initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 14 }} className="flex">
                                        <Heart size={15} fill={p.liked ? '#ff4d6d' : 'none'} stroke={p.liked ? '#ff4d6d' : '#fff'} />
                                    </motion.span>
                                    {p.like_count > 0 && p.like_count}
                                </button>
                            </motion.figure>
                        ))}
                    </div>
                )}

                {photos.length < total && (
                    <div className="flex justify-center mt-10">
                        <button
                            onClick={() => load(false, photos.length)}
                            disabled={loadingMore}
                            className="px-8 py-3.5 rounded-full text-xs font-bold uppercase tracking-widest disabled:opacity-50 transition-opacity"
                            style={{ border: `2px solid ${primary}`, color: primary }}
                        >
                            {loadingMore ? 'Loading…' : `Show more (${total - photos.length})`}
                        </button>
                    </div>
                )}

                <p className="text-center text-[10px] uppercase tracking-[0.3em] opacity-30 mt-16">Powered by SnapWrap</p>
            </div>

            {/* Floating dock */}
            <div className="fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-[max(20px,env(safe-area-inset-bottom))] pointer-events-none">
                <div
                    className="pointer-events-auto flex items-center gap-1.5 p-1.5 rounded-full backdrop-blur-xl shadow-2xl"
                    style={{ background: `color-mix(in srgb, ${secondary} 78%, transparent)`, border: `1px solid ${primary}22`, boxShadow: `0 20px 50px -14px ${primary}55` }}
                >
                    <div className="flex rounded-full p-1" style={{ background: `${primary}12` }}>
                        {(['new', 'loved'] as const).map(s => (
                            <button
                                key={s}
                                onClick={() => setSort(s)}
                                className="h-9 px-4 rounded-full text-xs font-bold transition-colors"
                                style={sort === s ? { background: primary, color: onPrimary } : { color: primary, opacity: 0.6 }}
                            >
                                {s === 'new' ? 'Newest' : 'Most loved'}
                            </button>
                        ))}
                    </div>
                    {facets && (facets.guests.length > 1 || facets.prompts.length > 0) && (
                        <button onClick={() => setFilterOpen(true)} className={`${dockBtn} relative`} style={{ color: primary }} aria-label="Filter">
                            <SlidersHorizontal size={17} />
                            {filtersOn > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[9px] flex items-center justify-center" style={{ background: primary, color: onPrimary }}>{filtersOn}</span>}
                        </button>
                    )}
                    <button onClick={downloadAll} disabled={!!zip || total === 0} className={`${dockBtn} disabled:opacity-60`} style={{ background: primary, color: onPrimary }} aria-label="Download all photos">
                        {zip ? <><Loader2 size={15} className="animate-spin" /> {zip.done}/{zip.total}</> : <><Archive size={15} /> <span className="hidden sm:inline">Download all</span></>}
                    </button>
                    <Link href={`/g/${event.slug}`} className={dockBtn} style={{ color: primary }} aria-label="Back to your shots">
                        <Camera size={17} />
                    </Link>
                </div>
            </div>

            {/* Filter sheet */}
            <AnimatePresence>
                {filterOpen && facets && (
                    <motion.div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setFilterOpen(false)}>
                        <motion.div
                            className="w-full sm:max-w-md rounded-t-[2rem] sm:rounded-[2rem] p-6 pb-[max(24px,env(safe-area-inset-bottom))] max-h-[80dvh] overflow-y-auto"
                            style={{ background: secondary, color: primary }}
                            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                            transition={{ type: 'spring', stiffness: 360, damping: 36 }}
                            drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.6 }}
                            onDragEnd={(_, i) => { if (i.offset.y > 100) setFilterOpen(false); }}
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="w-10 h-1 rounded-full mx-auto mb-5 opacity-20" style={{ background: primary }} />
                            <div className="flex items-center justify-between mb-5">
                                <h3 className="text-lg font-bold">Filter photos</h3>
                                <button onClick={() => setFilterOpen(false)} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: `${primary}12` }} aria-label="Close"><X size={16} /></button>
                            </div>

                            {facets.guests.length > 1 && (
                                <div className="mb-6">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.25em] opacity-50 mb-3">By guest</p>
                                    <div className="flex flex-wrap gap-2">
                                        {[{ id: null as string | null, name: 'Everyone', count: 0 }, ...facets.guests].map(g => {
                                            const on = guest === g.id;
                                            return (
                                                <button key={g.id ?? 'all'} onClick={() => setGuest(g.id)} className="px-4 py-2 rounded-full text-xs font-bold flex items-center gap-1.5 transition-colors" style={on ? { background: primary, color: onPrimary } : { background: `${primary}12`, color: primary }}>
                                                    {on && <Check size={12} />}{g.name}{g.count ? <span className="opacity-60 font-medium">{g.count}</span> : null}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                            {facets.prompts.length > 0 && (
                                <div className="mb-6">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.25em] opacity-50 mb-3">By moment</p>
                                    <div className="flex flex-wrap gap-2">
                                        {[{ id: null as string | null, name: 'All moments' }, ...facets.prompts.map(p => ({ id: p as string | null, name: p }))].map(m => {
                                            const on = prompt === m.id;
                                            return (
                                                <button key={m.id ?? 'all'} onClick={() => setPrompt(m.id)} className="px-4 py-2 rounded-full text-xs font-bold flex items-center gap-1.5 transition-colors" style={on ? { background: primary, color: onPrimary } : { background: `${primary}12`, color: primary }}>
                                                    {on && <Check size={12} />}{m.name}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                            <div className="flex gap-3">
                                <button onClick={() => { setGuest(null); setPrompt(null); }} disabled={!filtersOn} className="flex-1 py-3.5 rounded-full text-xs font-bold uppercase tracking-widest disabled:opacity-30" style={{ border: `2px solid ${primary}33` }}>Clear</button>
                                <button onClick={() => setFilterOpen(false)} className="flex-[1.5] py-3.5 rounded-full text-xs font-bold uppercase tracking-widest" style={{ background: primary, color: onPrimary }}>Show {total.toLocaleString()} photos</button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <ImageViewer
                items={photos.map(p => ({ id: p.id, src: p.image_url, thumb: p.thumb_url, title: p.caption, subtitle: p.guest_name }))}
                index={viewer}
                onIndexChange={setViewer}
                onClose={() => setViewer(null)}
                onNearEnd={photos.length < total && !loadingMore ? () => load(false, photos.length) : undefined}
                actions={(item, i) => {
                    const p = photos[i];
                    return (
                        <>
                            {p && (
                                <button onClick={() => heart(p)} className={viewerButton}>
                                    <Heart size={17} fill={p.liked ? '#ff4d6d' : 'none'} stroke={p.liked ? '#ff4d6d' : '#fff'} /> {p.like_count || 'Heart'}
                                </button>
                            )}
                            <button onClick={() => saveOne(item)} className={viewerButtonPrimary}><Download size={16} /> Save</button>
                        </>
                    );
                }}
            />
        </main>
    );
}
