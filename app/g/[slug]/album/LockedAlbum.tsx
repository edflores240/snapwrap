'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { Camera, Lock, Sparkles } from 'lucide-react';
import { countdownParts } from '@/lib/guest-camera';
import { contrastOn } from '@/lib/event-theme';
import { eventTitleClass, eventTitleSize } from '@/lib/gallery-typography';

const TILES = 18;

interface Props {
    title: string;
    /** Event colour scheme: text and accents, and the page background */
    primary: string;
    secondary: string;
    config: Record<string, unknown> | null;
    slug: string;
    /** When the album opens; null means the host will release it by hand */
    revealAtMs: number | null;
    now: number;
    /** Approved photos waiting behind the lock */
    total: number;
    /** ~24px previews; blurred again here */
    teaser: string[];
    unlocking: boolean;
}

function Digit({ value }: { value: string }) {
    return (
        <span className="relative inline-block w-[0.62em] h-[1.1em] overflow-hidden align-bottom">
            <AnimatePresence initial={false} mode="popLayout">
                <motion.span
                    key={value}
                    className="absolute inset-0 flex items-center justify-center"
                    initial={{ y: '70%', opacity: 0 }}
                    animate={{ y: '0%', opacity: 1 }}
                    exit={{ y: '-70%', opacity: 0 }}
                    transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                >
                    {value}
                </motion.span>
            </AnimatePresence>
        </span>
    );
}

function Unit({ value, label, primary }: { value: number; label: string; primary: string }) {
    const text = String(value).padStart(2, '0');
    return (
        <div className="flex flex-col items-center gap-2 min-w-0">
            <div
                className="inline-flex whitespace-nowrap rounded-xl sm:rounded-2xl px-2.5 sm:px-5 py-2.5 sm:py-4 text-3xl sm:text-6xl font-semibold tabular-nums"
                style={{ fontFamily: '"Playfair Display", Georgia, serif', color: primary, background: `linear-gradient(180deg, ${primary}1f, ${primary}0a)`, border: `1px solid ${primary}22`, boxShadow: `inset 0 1px 0 ${primary}22, 0 10px 30px -14px ${primary}66` }}
            >
                <Digit value={text[0]} /><Digit value={text[1]} />
            </div>
            <span className="text-[9px] sm:text-[11px] font-bold uppercase tracking-[0.25em] sm:tracking-[0.3em] opacity-50">{label}</span>
        </div>
    );
}

/** The album before it opens: a blurred mosaic of what's inside, a glass card and a live countdown */
export default function LockedAlbum({ title, primary, secondary, config, slug, revealAtMs, now, total, teaser, unlocking }: Props) {
    const accent = primary;
    const parts = revealAtMs ? countdownParts(revealAtMs - now) : null;

    // Previews repeat to fill the wall; without any, soft tiles in the event colour stand in
    const tiles = useMemo(() => Array.from({ length: TILES }, (_, i) => ({
        src: teaser.length ? teaser[i % teaser.length] : null,
        mix: 18 + ((i * 37) % 52),
        delay: (i % 6) * 0.4,
        duration: 7 + ((i * 13) % 6),
    })), [teaser]);

    const when = revealAtMs
        ? new Date(revealAtMs).toLocaleString(undefined, { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })
        : null;

    return (
        <main className="fixed inset-0 overflow-y-auto" style={{ background: secondary, color: primary }}>
            {/* Mosaic */}
            <div aria-hidden className="absolute inset-0 overflow-hidden">
                <div className="absolute -inset-[12%] -rotate-6 grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4 content-center">
                    {tiles.map((t, i) => (
                        <motion.div
                            key={i}
                            className="relative aspect-[3/4] rounded-3xl overflow-hidden"
                            animate={{ y: [0, i % 2 ? -14 : 14, 0] }}
                            transition={{ duration: t.duration, delay: t.delay, repeat: Infinity, ease: 'easeInOut' }}
                            style={{ background: `color-mix(in srgb, ${primary} ${Math.round(t.mix / 2.2)}%, ${secondary})` }}
                        >
                            {t.src && (
                                <div
                                    className="absolute inset-0 bg-cover bg-center"
                                    style={{ backgroundImage: `url(${t.src})`, filter: 'blur(22px) saturate(1.4)', transform: 'scale(1.5)' }}
                                />
                            )}
                            <div className="absolute inset-0" style={{ background: 'linear-gradient(160deg, rgba(255,255,255,0.14), transparent 55%)' }} />
                        </motion.div>
                    ))}
                </div>
                {/* Glow and vignette */}
                <div className="absolute inset-0" style={{ background: `radial-gradient(60% 50% at 50% 42%, ${primary}22, transparent 70%), radial-gradient(120% 90% at 50% 50%, transparent 25%, ${secondary} 95%)` }} />
                <div className="absolute inset-0 backdrop-blur-[2px]" style={{ background: `${secondary}99` }} />
            </div>

            <div className="relative min-h-full flex items-center justify-center px-4 py-12 pt-[max(48px,env(safe-area-inset-top))]">
                <motion.section
                    initial={{ opacity: 0, y: 24, scale: 0.97 }}
                    animate={unlocking ? { opacity: 0, scale: 1.06, filter: 'blur(10px)' } : { opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: unlocking ? 0.7 : 0.9, ease: [0.22, 1, 0.36, 1] }}
                    className="w-full min-w-0 max-w-xl text-center rounded-[2rem] sm:rounded-[2.25rem] px-4 sm:px-10 py-9 sm:py-12 backdrop-blur-2xl"
                    style={{ background: `color-mix(in srgb, ${secondary} 72%, transparent)`, border: `1px solid ${primary}22`, boxShadow: `0 40px 80px -34px ${primary}66, inset 0 1px 0 ${primary}18` }}
                >
                    <motion.div
                        className="mx-auto mb-6 w-16 h-16 rounded-full flex items-center justify-center"
                        style={{ background: `radial-gradient(circle at 30% 25%, ${primary}, color-mix(in srgb, ${primary} 70%, #000))`, boxShadow: `0 0 0 8px ${primary}22, 0 10px 40px -10px ${primary}` }}
                        animate={{ scale: [1, 1.06, 1] }}
                        transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
                    >
                        <Lock size={26} style={{ color: contrastOn(primary) }} />
                    </motion.div>

                    <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.4em] opacity-50 mb-3">The album</p>
                    <h1 className={`font-black tracking-tighter leading-[0.98] mb-3 break-words ${eventTitleClass(config)}`} style={{ fontSize: eventTitleSize(config, title), overflowWrap: 'anywhere' }}>{title}</h1>

                    {total > 0 && (
                        <p className="inline-flex items-center gap-2 text-sm opacity-70 mb-8">
                            <Sparkles size={14} style={{ color: accent }} />
                            {total.toLocaleString()} {total === 1 ? 'moment is' : 'moments are'} waiting for you
                        </p>
                    )}
                    {total === 0 && <p className="text-sm opacity-60 mb-8">Photos are being captured right now.</p>}

                    {parts ? (
                        <>
                            <p className="text-[11px] font-bold uppercase tracking-[0.35em] opacity-50 mb-5">Unlocks in</p>
                            <div className="flex justify-center items-start gap-1.5 sm:gap-4">
                                {parts.days > 0 && <Unit primary={primary} value={parts.days} label={parts.days === 1 ? 'day' : 'days'} />}
                                <Unit primary={primary} value={parts.hours} label="hours" />
                                <Unit primary={primary} value={parts.minutes} label="min" />
                                <Unit primary={primary} value={parts.seconds} label="sec" />
                            </div>
                            {when && <p className="mt-8 text-xs opacity-50">{when}</p>}
                        </>
                    ) : (
                        <div className="flex flex-col items-center gap-4">
                            <div className="flex items-center gap-2.5 opacity-70 text-sm">
                                <span className="relative flex w-2.5 h-2.5">
                                    <span className="absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping" style={{ background: accent }} />
                                    <span className="relative inline-flex w-2.5 h-2.5 rounded-full" style={{ background: accent }} />
                                </span>
                                Waiting for the host to open the album
                            </div>
                            <p className="text-xs opacity-40">Keep this page open. It unlocks by itself.</p>
                        </div>
                    )}

                    <Link
                        href={`/g/${slug}`}
                        className="mt-10 inline-flex items-center gap-2 rounded-full transition-opacity hover:opacity-80 px-6 py-3 text-xs font-bold uppercase tracking-widest"
                        style={{ border: `1.5px solid ${primary}44`, background: `${primary}0d` }}
                    >
                        <Camera size={14} /> Back to your shots
                    </Link>
                    <div className="mt-3">
                        <Link href={`/e/${slug}/gallery`} className="text-xs font-bold uppercase tracking-widest opacity-60 hover:opacity-100 transition-opacity underline underline-offset-4">
                            See the gallery
                        </Link>
                    </div>
                </motion.section>
            </div>
        </main>
    );
}
