'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Camera, Trash2, Clock, Images, X, Loader2, CheckCircle2, EyeOff, Trash } from 'lucide-react';
import {
    countdownParts, deleteMyPhoto, getGuestState, getMyPhotos, guestErrorMessage, joinGuest,
    loadGuestIdentity, readGuestConfig, saveGuestIdentity, uuid,
    type CapturedShot, type GuestIdentity, type GuestPhoto, type GuestState,
} from '@/lib/guest-camera';
import { enqueuePhoto, initUploadQueue, listQueuedPhotos, onPhotoRejected, removeQueuedPhoto, useUploadQueue } from '@/lib/upload-queue';
import GuestCamera from './GuestCamera';
import ImageViewer, { viewerButtonPrimary } from '@/components/ui/ImageViewer';
import { accentOnDark, contrastOn, resolveEventTheme } from '@/lib/event-theme';
import { eventBodyClass, eventTitleClass, eventTitleSize } from '@/lib/gallery-typography';

export interface GuestEvent {
    id: string;
    name: string;
    slug: string;
    date: string | null;
    config: Record<string, unknown> | null;
}

interface ShotView {
    id: string;
    url: string;
    /** Full-size picture for the viewer */
    full: string;
    caption: string | null;
    status: 'uploading' | 'pending' | 'approved';
}


function Countdown({ target, now, primary }: { target: number; now: number; primary: string }) {
    const p = countdownParts(target - now);
    const cells = [
        ...(p.days > 0 ? [{ v: p.days, l: p.days === 1 ? 'day' : 'days' }] : []),
        { v: p.hours, l: 'hrs' }, { v: p.minutes, l: 'min' }, { v: p.seconds, l: 'sec' },
    ];
    return (
        <div className="flex justify-center gap-3">
            {cells.map(c => (
                <div key={c.l} className="min-w-[64px] rounded-2xl py-3" style={{ background: `${primary}0d`, border: `1px solid ${primary}1a` }}>
                    <div className="text-3xl font-black tabular-nums" style={{ fontFamily: '"Playfair Display", Georgia, serif' }}>{String(c.v).padStart(2, '0')}</div>
                    <div className="text-[10px] font-bold uppercase tracking-widest opacity-50">{c.l}</div>
                </div>
            ))}
        </div>
    );
}

export default function GuestApp({ event }: { event: GuestEvent }) {
    const cfg = useMemo(() => readGuestConfig((event.config as { guestCamera?: unknown } | null)?.guestCamera), [event.config]);
    const theme = useMemo(() => resolveEventTheme(event.config), [event.config]);
    const accent = theme.primary;
    const onAccent = contrastOn(accent);
    const card = { background: `${accent}0d`, border: `1px solid ${accent}1a` };
    const field = { background: `${accent}0a`, border: `1px solid ${accent}26`, color: accent };

    const [booted, setBooted] = useState(false);
    const [identity, setIdentity] = useState<GuestIdentity | null>(null);
    const [state, setState] = useState<GuestState | null>(null);
    const [skew, setSkew] = useState(0);
    const [now, setNow] = useState(() => Date.now());
    const [serverPhotos, setServerPhotos] = useState<GuestPhoto[]>([]);
    const [queued, setQueued] = useState<ShotView[]>([]);
    const [cameraOpen, setCameraOpen] = useState(false);
    const [viewer, setViewer] = useState<number | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<ShotView | null>(null);
    const [name, setName] = useState('');
    const [table, setTable] = useState('');
    const [joining, setJoining] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const queueUrls = useRef<string[]>([]);

    const queue = useUploadQueue();

    const applyState = useCallback((s: GuestState) => {
        setState(s);
        if (s.now) setSkew(new Date(s.now).getTime() - Date.now());
    }, []);

    const refreshPhotos = useCallback(async (sessionId: string) => {
        const [mine, waiting] = await Promise.all([
            getMyPhotos(event.id, sessionId).catch(() => null),
            listQueuedPhotos(event.id),
        ]);
        if (mine) setServerPhotos(mine);
        queueUrls.current.forEach(u => URL.revokeObjectURL(u));
        queueUrls.current = [];
        setQueued(waiting.filter(w => w.guest?.sessionId === sessionId).map(w => {
            const url = URL.createObjectURL(w.thumb ?? w.full);
            queueUrls.current.push(url);
            return { id: w.id, url, full: url, caption: w.guest?.caption ?? null, status: 'uploading' as const };
        }));
    }, [event.id]);

    // Boot: pick the guest up where they left off
    useEffect(() => {
        initUploadQueue();
        const saved = loadGuestIdentity(event.id);
        setIdentity(saved);
        (async () => {
            try {
                const s = saved ? await joinGuest(event.id, saved.sessionId, saved.name, saved.table) : await getGuestState(event.id, null);
                applyState(s);
                if (saved) await refreshPhotos(saved.sessionId);
            } catch (err) {
                console.error('Guest camera failed to load:', (err as Error).message);
                setLoadError('We couldn\'t reach the event. Check your connection and refresh.');
            } finally {
                setBooted(true);
            }
        })();
        return () => queueUrls.current.forEach(u => URL.revokeObjectURL(u));
    }, [event.id, applyState, refreshPhotos]);

    // Clock for countdowns, plus a slow refresh so phase changes arrive from the server
    useEffect(() => {
        const tick = setInterval(() => setNow(Date.now() + skew), 1000);
        return () => clearInterval(tick);
    }, [skew]);

    useEffect(() => {
        if (!identity) return;
        const poll = setInterval(() => {
            getGuestState(event.id, identity.sessionId).then(applyState).catch(() => undefined);
        }, 30000);
        return () => clearInterval(poll);
    }, [identity, event.id, applyState]);

    // Uploads finishing change what the server knows
    useEffect(() => {
        if (!identity) return;
        refreshPhotos(identity.sessionId);
        getGuestState(event.id, identity.sessionId).then(applyState).catch(() => undefined);
    }, [queue.pending, identity, event.id, refreshPhotos, applyState]);

    useEffect(() => onPhotoRejected((_id, code) => {
        setNotice(`One photo couldn't be saved. ${guestErrorMessage(code)}`);
        if (identity) refreshPhotos(identity.sessionId);
    }), [identity, refreshPhotos]);

    const join = async () => {
        if (joining) return;
        setJoining(true);
        const id: GuestIdentity = { sessionId: uuid(), name: name.trim(), table: table.trim() };
        try {
            const s = await joinGuest(event.id, id.sessionId, id.name, id.table);
            saveGuestIdentity(event.id, id);
            setIdentity(id);
            applyState(s);
            await refreshPhotos(id.sessionId);
        } catch (err) {
            setNotice((err as Error).message === 'guest_disabled' ? 'This camera isn\'t available.' : 'We couldn\'t sign you in. Try again.');
        } finally {
            setJoining(false);
        }
    };

    const shots: ShotView[] = useMemo(() => {
        const known = new Set(serverPhotos.map(p => p.id));
        return [
            ...serverPhotos.map(p => ({
                id: p.id,
                url: p.thumb_url || p.image_url,
                full: p.image_url,
                caption: p.caption,
                status: p.guest_status === 'approved' ? 'approved' as const : 'pending' as const,
            })).reverse(),
            ...queued.filter(q => !known.has(q.id)),
        ].sort((a, b) => Number(b.status === 'uploading') - Number(a.status === 'uploading'));
    }, [serverPhotos, queued]);

    const quota = state?.quota ?? cfg.shotsPerGuest;
    const shotsLeft = Math.max(0, quota - shots.length);

    // Phase from the server's times and the skew-corrected clock
    const opensAt = state?.opensAt ? new Date(state.opensAt).getTime() : null;
    const closesAt = state?.closesAt ? new Date(state.closesAt).getTime() : null;
    const revealAt = state?.revealAt ? new Date(state.revealAt).getTime() : null;
    const phase = opensAt && now < opensAt ? 'not_open' : closesAt && now >= closesAt ? 'closed' : 'open';
    const revealed = revealAt !== null && now >= revealAt;

    const keepShot = async (shot: CapturedShot, caption: string, prompt: string | null) => {
        if (!identity) return;
        await enqueuePhoto({
            id: uuid(),
            eventId: event.id,
            eventSlug: event.slug,
            full: shot.full,
            thumb: shot.thumb,
            guest: { sessionId: identity.sessionId, caption: caption.trim() || null, prompt, preview: shot.preview },
        });
        await refreshPhotos(identity.sessionId);
    };

    const removeShot = async (shot: ShotView) => {
        if (!identity) return;
        setConfirmDelete(null);
        setViewer(null);
        try {
            if (shot.status === 'uploading') await removeQueuedPhoto(shot.id);
            else await deleteMyPhoto(shot.id, identity.sessionId);
            await refreshPhotos(identity.sessionId);
            getGuestState(event.id, identity.sessionId).then(applyState).catch(() => undefined);
        } catch {
            setNotice('We couldn\'t delete that photo. Try again.');
        }
    };

    const shell = (children: React.ReactNode) => (
        <main className={`min-h-[100dvh] ${eventBodyClass(event.config)}`} style={{ background: theme.secondary, color: theme.primary }}>
            <div className="max-w-md mx-auto px-5 pt-[max(28px,env(safe-area-inset-top))] pb-24">
                <header className="text-center mb-8">
                    <p className="text-[10px] font-bold uppercase tracking-[0.35em] opacity-40 mb-3">Guest camera</p>
                    <h1 className={`font-black tracking-tighter leading-[0.98] break-words ${eventTitleClass(event.config)}`} style={{ fontSize: eventTitleSize(event.config, cfg.welcomeTitle || event.name), overflowWrap: 'anywhere' }}>{cfg.welcomeTitle || event.name}</h1>
                    {event.date && (
                        <p className="text-xs opacity-50 mt-2">
                            {new Date(event.date).toLocaleDateString(undefined, { dateStyle: 'long' })}
                        </p>
                    )}
                </header>
                {children}
            </div>
            {notice && (
                <div className="fixed bottom-5 inset-x-5 max-w-md mx-auto z-50 text-sm rounded-2xl px-4 py-3 flex items-start gap-3 shadow-2xl" style={{ background: accent, color: onAccent }}>
                    <span className="flex-1">{notice}</span>
                    <button onClick={() => setNotice(null)} aria-label="Dismiss"><X size={16} /></button>
                </div>
            )}
        </main>
    );

    if (!booted) {
        return shell(<div className="flex justify-center py-16 opacity-40"><Loader2 className="animate-spin" /></div>);
    }
    if (loadError) {
        return shell(<p className="text-center text-sm opacity-70">{loadError}</p>);
    }
    if (!state?.enabled) {
        return shell(<p className="text-center text-sm opacity-70">The guest camera isn&apos;t switched on for this event.</p>);
    }

    // First visit
    if (!identity) {
        return shell(
            <div className="rounded-3xl p-6 space-y-5 shadow-sm" style={card}>
                <p className="text-center text-sm opacity-70 leading-relaxed">
                    {cfg.welcomeMessage || `Capture the moments you love tonight. You get ${quota} photos, and nobody sees them until the host shares the album.`}
                </p>
                <ul className="text-sm space-y-2 opacity-80">
                    <li className="flex gap-3"><Camera size={16} className="mt-0.5 shrink-0" /> {quota} shots each. Delete one to take it again.</li>
                    <li className="flex gap-3"><EyeOff size={16} className="mt-0.5 shrink-0" /> Photos stay hidden until the reveal.</li>
                    <li className="flex gap-3"><Images size={16} className="mt-0.5 shrink-0" /> Come back to this page any time to see your shots.</li>
                </ul>
                {cfg.askName && (
                    <input
                        value={name} onChange={e => setName(e.target.value)} maxLength={60}
                        placeholder="Your name"
                        className="w-full rounded-2xl px-4 py-3.5 text-[15px] outline-none placeholder:opacity-50"
                        style={field}
                    />
                )}
                {cfg.askTable && (
                    <input
                        value={table} onChange={e => setTable(e.target.value)} maxLength={30}
                        placeholder="Table (optional)"
                        className="w-full rounded-2xl px-4 py-3.5 text-[15px] outline-none placeholder:opacity-50"
                        style={field}
                    />
                )}
                <button
                    onClick={join}
                    disabled={joining}
                    className="w-full py-4 rounded-2xl font-bold tracking-wide disabled:opacity-60"
                    style={{ background: accent, color: onAccent }}
                >
                    {joining ? 'One moment…' : 'Let\'s go'}
                </button>
            </div>
        );
    }

    if (state.blocked) {
        return shell(<p className="text-center text-sm opacity-70">This device can&apos;t add photos to the event any more. Please find the host if this is a mistake.</p>);
    }

    const dots = Array.from({ length: Math.min(quota, 30) }, (_, i) => i < shots.length);

    return shell(
        <>
            <section className="rounded-3xl p-6 text-center space-y-5 shadow-sm" style={card}>
                {identity.name && <p className="text-sm opacity-60">Hi {identity.name} 👋</p>}

                {phase === 'not_open' && opensAt && (
                    <>
                        <p className="text-[11px] font-bold uppercase tracking-[0.25em] opacity-50">The camera opens in</p>
                        <Countdown target={opensAt} now={now} primary={accent} />
                    </>
                )}

                {phase === 'open' && (
                    <>
                        <div className="flex justify-center flex-wrap gap-1.5">
                            {dots.map((used, i) => (
                                <span key={i} className="w-2.5 h-2.5 rounded-full" style={{ background: used ? accent : 'transparent', border: `1.5px solid ${accent}`, opacity: used ? 1 : 0.35 }} />
                            ))}
                        </div>
                        <p className="text-sm font-semibold">
                            {shotsLeft > 0 ? `${shotsLeft} of ${quota} shots left` : `You've used all ${quota} shots`}
                        </p>
                        <button
                            onClick={() => setCameraOpen(true)}
                            disabled={shotsLeft <= 0}
                            className="w-full py-4 rounded-2xl font-bold tracking-wide flex items-center justify-center gap-2.5 disabled:opacity-40"
                            style={{ background: accent, color: onAccent }}
                        >
                            <Camera size={20} /> {shotsLeft > 0 ? 'Open camera' : 'No shots left'}
                        </button>
                        {shotsLeft <= 0 && shots.length > 0 && <p className="text-xs opacity-50">Delete a shot below to take it again.</p>}
                        {closesAt && <p className="text-xs opacity-50 flex items-center justify-center gap-1.5"><Clock size={12} /> Closes {new Date(closesAt).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })}</p>}
                    </>
                )}

                {phase === 'closed' && (
                    <p className="text-sm opacity-70">{cfg.thankYouMessage || 'The camera is closed. Thank you for helping capture the day!'}</p>
                )}

                {(phase === 'closed' || shots.length > 0) && (
                    revealed ? (
                        <Link href={`/g/${event.slug}/album`} className="block w-full py-4 rounded-2xl font-bold tracking-wide" style={{ background: accent, color: onAccent }}>
                            View the album
                        </Link>
                    ) : revealAt ? (
                        <div className="space-y-3 pt-1">
                            <p className="text-[11px] font-bold uppercase tracking-[0.25em] opacity-50">The album opens in</p>
                            <Countdown target={revealAt} now={now} primary={accent} />
                        </div>
                    ) : (
                        <p className="text-xs opacity-50">The host will share the album soon. Check back here.</p>
                    )
                )}
            </section>

            <section className="mt-10">
                <div className="flex items-baseline justify-between mb-4">
                    <h2 className={`text-2xl font-black tracking-tight ${eventTitleClass(event.config)}`}>Your shots</h2>
                    <span className="text-xs opacity-50">{shots.length} / {quota}</span>
                </div>
                {shots.length === 0 ? (
                    <p className="text-center text-sm opacity-50 py-10">Nothing yet. Your photos will show up here.</p>
                ) : (
                    <div className="grid grid-cols-2 gap-3">
                        {shots.map(shot => (
                            <div key={shot.id} className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-black/5 shadow-sm">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={shot.url} alt="" className="w-full h-full object-cover" onClick={() => setViewer(shots.indexOf(shot))} />
                                <div className="absolute left-2 bottom-2 px-2 py-1 rounded-full bg-black/60 text-white text-[10px] font-bold flex items-center gap-1 backdrop-blur">
                                    {shot.status === 'uploading' ? <><Loader2 size={10} className="animate-spin" /> Saving</> :
                                        shot.status === 'pending' ? <><Clock size={10} /> Waiting for host</> :
                                            <><CheckCircle2 size={10} /> Saved</>}
                                </div>
                                <button
                                    onClick={() => setConfirmDelete(shot)}
                                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/55 text-white flex items-center justify-center backdrop-blur"
                                    aria-label="Delete photo"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <p className="text-center text-[10px] uppercase tracking-[0.3em] opacity-30 mt-12">Powered by SnapWrap</p>

            {cameraOpen && (
                <GuestCamera
                    config={cfg}
                    accent={accentOnDark(theme)}
                    shotsLeft={shotsLeft}
                    onClose={() => setCameraOpen(false)}
                    onKeep={keepShot}
                />
            )}

            <ImageViewer
                items={shots.map(sh => ({ id: sh.id, src: sh.full, thumb: sh.url, title: sh.caption }))}
                index={viewer}
                onIndexChange={setViewer}
                onClose={() => setViewer(null)}
                actions={(item) => {
                    const shot = shots.find(sh => sh.id === item.id);
                    return shot ? (
                        <button onClick={() => setConfirmDelete(shot)} className={viewerButtonPrimary}><Trash size={16} /> Delete &amp; retake</button>
                    ) : null;
                }}
            />

            {confirmDelete && (
                <div className="fixed inset-0 z-[400] bg-black/50 flex items-end sm:items-center justify-center p-4" onClick={() => setConfirmDelete(null)}>
                    <div className="w-full max-w-sm rounded-3xl p-6 space-y-4" style={{ background: theme.secondary, color: theme.primary }} onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold">Delete this photo?</h3>
                        <p className="text-sm opacity-60">You&apos;ll get the shot back so you can take it again.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setConfirmDelete(null)} className="flex-1 py-3 rounded-2xl font-bold text-sm" style={{ background: `${accent}12` }}>Keep it</button>
                            <button onClick={() => removeShot(confirmDelete)} className="flex-1 py-3 rounded-2xl bg-red-500 text-white font-bold text-sm">Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
