'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import type { ThemeColors } from '@/lib/color-utils';

interface PortfolioItem {
    id: string;
    name: string;
    slug: string;
    date: string;
    thumbnail: string | null;
}

interface PortfolioProps {
    items: PortfolioItem[];
    accent: string;
    accentContrast: string;
    t: ThemeColors;
    headingFontClass: string;
    variant: string;
}

const n = (i: number) => `N°${String(i + 1).padStart(2, '0')}`;
const yr = (d: string) => (d ? new Date(d).getFullYear() : null);

// ─── Shared entry animation ───────────────────────────────────────────────────

const fadeUp = (delay = 0) => ({
    initial: { opacity: 0, y: 20 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true },
    transition: { duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
});

// ─── Section header (editorial style) ────────────────────────────────────────

function Header({ t, accent, headingFontClass, children }: {
    t: ThemeColors; accent: string; headingFontClass: string; children?: React.ReactNode;
}) {
    return (
        <motion.div {...fadeUp()}>
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] mb-3" style={{ color: accent }}>
                Portfolio
            </p>
            <h2 className={`text-2xl md:text-4xl font-black leading-tight ${headingFontClass}`} style={{ color: t.text }}>
                Highlights from{' '}<span style={{ fontStyle: 'italic' }}>the collection</span>
            </h2>
            {children}
        </motion.div>
    );
}

export default function PortfolioSection({ items, accent, accentContrast, t, headingFontClass, variant }: PortfolioProps) {
    if (!items || items.length === 0) return null;

    // ── CAROUSEL — Infinite auto-scroll marquee ──────────────────────────────
    if (variant === 'carousel') {
        // 3 copies → animate by -33.333% for seamless loop
        const tripled = [...items, ...items, ...items];
        const dur = Math.max(22, items.length * 7);

        return (
            <section className="py-20 overflow-hidden" style={{ background: t.surface, borderTop: `1px solid ${t.border}`, borderBottom: `1px solid ${t.border}` }}>
                <style>{`
                    @keyframes sw-marquee { from { transform: translateX(0); } to { transform: translateX(-33.333%); } }
                    .sw-marquee { animation: sw-marquee ${dur}s linear infinite; will-change: transform; }
                    .sw-marquee:hover { animation-play-state: paused; }
                `}</style>

                {/* Header row */}
                <div className="max-w-7xl mx-auto px-6 md:px-12 mb-10 flex items-end justify-between gap-4">
                    <Header t={t} accent={accent} headingFontClass={headingFontClass} />
                    <div className="hidden md:flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs font-medium" style={{ color: t.muted }}>Auto-scrolling</span>
                        <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: accent }} />
                    </div>
                </div>

                {/* Edge fades */}
                <div className="relative">
                    <div className="absolute left-0 top-0 bottom-0 w-16 z-10 pointer-events-none"
                        style={{ background: `linear-gradient(90deg, ${t.surface}, transparent)` }} />
                    <div className="absolute right-0 top-0 bottom-0 w-16 z-10 pointer-events-none"
                        style={{ background: `linear-gradient(270deg, ${t.surface}, transparent)` }} />

                    <div className="sw-marquee flex gap-4 w-max">
                        {tripled.map((item, i) => (
                            <Link key={`${item.id}-${i}`} href={`/e/${item.slug}/gallery`}
                                className="group relative flex-shrink-0 overflow-hidden rounded-2xl"
                                style={{ width: 260, height: 370 }}>
                                {item.thumbnail && (
                                    <Image src={item.thumbnail} alt={item.name} fill
                                        className="object-cover transition-transform duration-700 group-hover:scale-105" />
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
                                <div className="absolute top-4 left-4">
                                    <span className="text-[10px] font-bold tracking-widest" style={{ color: 'rgba(255,255,255,0.4)' }}>
                                        {n(i % items.length)}
                                    </span>
                                </div>
                                <div className="absolute bottom-0 left-0 right-0 p-4">
                                    <p className="text-white font-bold text-sm truncate">{item.name}</p>
                                    {yr(item.date) && (
                                        <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>{yr(item.date)}</p>
                                    )}
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            </section>
        );
    }

    // ── GRID — Editorial numbered grid (like the reference) ──────────────────
    if (variant === 'grid') {
        return (
            <section className="py-20" style={{ background: t.bg }}>
                <div className="max-w-7xl mx-auto px-6 md:px-12">

                    {/* Editorial header */}
                    <div className="mb-12 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
                        <motion.div {...fadeUp()}>
                            <p className="text-[10px] font-bold uppercase tracking-[0.3em] mb-4" style={{ color: accent }}>
                                Highlights from the Collection
                            </p>
                            <h2 className={`text-3xl md:text-5xl font-black leading-tight ${headingFontClass}`} style={{ color: t.text }}>
                                A <span style={{ fontStyle: 'italic' }}>curated</span> selection<br />
                                of exceptional <span style={{ fontStyle: 'italic' }}>moments</span>
                            </h2>
                        </motion.div>
                        <motion.p {...fadeUp(0.1)} className="text-xs font-medium flex-shrink-0" style={{ color: t.muted }}>
                            {items.length} events
                        </motion.p>
                    </div>

                    {/* Numbered grid */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-x-5 gap-y-10">
                        {items.slice(0, 6).map((item, i) => (
                            <motion.div key={item.id} {...fadeUp(i * 0.08)}>
                                <Link href={`/e/${item.slug}/gallery`} className="block group">
                                    <div className="relative aspect-[4/5] rounded-2xl overflow-hidden mb-4">
                                        {item.thumbnail && (
                                            <Image src={item.thumbnail} alt={item.name} fill
                                                className="object-cover transition-transform duration-700 group-hover:scale-105" />
                                        )}
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-500" />
                                        <div className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold opacity-0 group-hover:opacity-100 transition-all duration-300"
                                            style={{ backgroundColor: accent, color: accentContrast }}>
                                            ↗
                                        </div>
                                    </div>
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: t.muted }}>{n(i)}</p>
                                            <p className="text-sm font-bold truncate" style={{ color: t.text }}>{item.name}</p>
                                        </div>
                                        {yr(item.date) && (
                                            <p className="text-[10px] flex-shrink-0 mt-0.5" style={{ color: t.muted }}>{yr(item.date)}</p>
                                        )}
                                    </div>
                                </Link>
                            </motion.div>
                        ))}
                    </div>

                    {/* Bottom rule */}
                    <motion.div {...fadeUp(0.3)} className="mt-12 flex items-center gap-5">
                        <div className="flex-1 h-px" style={{ backgroundColor: t.border }} />
                        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: t.muted }}>
                            {items.length} total events
                        </span>
                        <div className="flex-1 h-px" style={{ backgroundColor: t.border }} />
                    </motion.div>
                </div>
            </section>
        );
    }

    // ── BENTO — Editorial asymmetric mosaic ──────────────────────────────────
    if (variant === 'bento') {
        const [hero, ...rest] = items;
        const side   = rest.slice(0, 3);
        const bottom = rest.slice(3, 7);

        return (
            <section className="py-20" style={{ background: t.surface }}>
                <div className="max-w-7xl mx-auto px-6 md:px-12">

                    {/* Label */}
                    <motion.div {...fadeUp()} className="mb-8">
                        <p className="text-[10px] font-bold uppercase tracking-[0.3em]" style={{ color: accent }}>Portfolio</p>
                    </motion.div>

                    {/* Main mosaic row */}
                    <div className="grid md:grid-cols-[3fr_1fr] gap-3 mb-3">
                        {/* Hero card with title overlay */}
                        <motion.div {...fadeUp(0.05)}>
                            <Link href={`/e/${hero.slug}`} className="block group relative rounded-3xl overflow-hidden" style={{ aspectRatio: '4/3' }}>
                                {hero.thumbnail && (
                                    <Image src={hero.thumbnail} alt={hero.name} fill
                                        className="object-cover transition-transform duration-700 group-hover:scale-105" />
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                                <div className="absolute bottom-0 left-0 p-6 md:p-8">
                                    <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'rgba(255,255,255,0.45)' }}>{n(0)}</p>
                                    <h3 className={`text-white text-2xl md:text-3xl font-black leading-tight ${headingFontClass}`}>
                                        {hero.name}
                                    </h3>
                                    {yr(hero.date) && <p className="text-xs mt-2" style={{ color: 'rgba(255,255,255,0.45)' }}>{yr(hero.date)}</p>}
                                </div>
                                <div className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                                    style={{ backgroundColor: accent, color: accentContrast }}>↗</div>
                            </Link>
                        </motion.div>

                        {/* Side stack */}
                        <div className="flex flex-col gap-3">
                            {side.map((item, i) => (
                                <motion.div key={item.id} {...fadeUp(0.1 + i * 0.06)} className="flex-1">
                                    <Link href={`/e/${item.slug}/gallery`} className="block group relative h-full rounded-2xl overflow-hidden" style={{ minHeight: 90 }}>
                                        {item.thumbnail && (
                                            <Image src={item.thumbnail} alt={item.name} fill className="object-cover transition-transform duration-500 group-hover:scale-105" />
                                        )}
                                        <div className="absolute inset-0 bg-black/35 group-hover:bg-black/55 transition-colors duration-300" />
                                        <div className="absolute bottom-2 left-3 flex items-center gap-2">
                                            <span className="text-[9px] font-bold" style={{ color: 'rgba(255,255,255,0.5)' }}>{n(i + 1)}</span>
                                        </div>
                                    </Link>
                                </motion.div>
                            ))}
                        </div>
                    </div>

                    {/* Bottom strip */}
                    {bottom.length > 0 && (
                        <div className={`grid gap-3 grid-cols-${Math.min(bottom.length, 4)}`}
                            style={{ gridTemplateColumns: `repeat(${Math.min(bottom.length, 4)}, minmax(0,1fr))` }}>
                            {bottom.map((item, i) => (
                                <motion.div key={item.id} {...fadeUp(0.2 + i * 0.06)}>
                                    <Link href={`/e/${item.slug}/gallery`} className="block group relative aspect-square rounded-2xl overflow-hidden">
                                        {item.thumbnail && (
                                            <Image src={item.thumbnail} alt={item.name} fill
                                                className="object-cover transition-transform duration-500 group-hover:scale-105" />
                                        )}
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/45 transition-colors duration-300" />
                                        <div className="absolute bottom-3 left-3">
                                            <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.5)' }}>{n(side.length + i + 1)}</p>
                                            <p className="text-white text-xs font-bold truncate mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300">{item.name}</p>
                                        </div>
                                    </Link>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>
            </section>
        );
    }

    // ── FILMSTRIP — Cinematic horizontal scroll reel ──────────────────────────
    if (variant === 'filmstrip') {
        return (
            <section className="py-20" style={{ background: t.bg }}>
                <div className="max-w-7xl mx-auto px-6 md:px-12 mb-8 flex items-end justify-between gap-4">
                    <motion.div {...fadeUp()}>
                        <p className="text-[10px] font-bold uppercase tracking-[0.3em] mb-2" style={{ color: accent }}>Scroll to explore</p>
                        <h2 className={`text-2xl md:text-3xl font-black ${headingFontClass}`} style={{ color: t.text }}>
                            The Gallery
                        </h2>
                    </motion.div>
                    <motion.span {...fadeUp(0.1)} className="hidden md:block text-xs" style={{ color: t.muted }}>drag →</motion.span>
                </div>

                <div className="overflow-x-auto pb-4 cursor-grab active:cursor-grabbing"
                    style={{ scrollbarWidth: 'none', scrollSnapType: 'x mandatory' }}>
                    <div className="flex gap-3 px-6 md:px-12 w-max">
                        {items.map((item, i) => (
                            <motion.div key={item.id} {...fadeUp(i * 0.06)}
                                className="group relative flex-shrink-0 rounded-2xl overflow-hidden"
                                style={{ width: 300, height: 460, scrollSnapAlign: 'start' }}>
                                <Link href={`/e/${item.slug}/gallery`} className="block h-full">
                                    {item.thumbnail && (
                                        <Image src={item.thumbnail} alt={item.name} fill
                                            className="object-cover transition-transform duration-700 group-hover:scale-105" />
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" />
                                    <div className="absolute top-5 left-5">
                                        <span className="text-sm font-bold" style={{ color: 'rgba(255,255,255,0.35)' }}>{n(i)}</span>
                                    </div>
                                    <div className="absolute bottom-0 left-0 right-0 p-5">
                                        <p className="text-white font-bold text-base truncate">{item.name}</p>
                                        {yr(item.date) && (
                                            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>{yr(item.date)}</p>
                                        )}
                                    </div>
                                </Link>
                            </motion.div>
                        ))}
                        {/* Spacer so last item isn't flush against edge */}
                        <div className="w-6 flex-shrink-0" />
                    </div>
                </div>
            </section>
        );
    }

    // ── FEATURE — Cinematic hero + numbered strip ────────────────────────────
    if (variant === 'feature') {
        const [hero, ...rest] = items;
        const strip = rest.slice(0, 5);

        return (
            <section className="py-20" style={{ background: t.surface }}>
                <div className="max-w-7xl mx-auto px-6 md:px-12">

                    <motion.div {...fadeUp()} className="mb-6">
                        <p className="text-[10px] font-bold uppercase tracking-[0.3em]" style={{ color: accent }}>
                            Featured Collection
                        </p>
                    </motion.div>

                    {/* Hero banner */}
                    <motion.div {...fadeUp(0.05)} className="mb-4">
                        <Link href={`/e/${hero.slug}`} className="block group">
                            <div className="relative rounded-3xl overflow-hidden" style={{ aspectRatio: '21/9' }}>
                                {hero.thumbnail && (
                                    <Image src={hero.thumbnail} alt={hero.name} fill
                                        className="object-cover transition-transform duration-700 group-hover:scale-105" />
                                )}
                                <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/35 to-transparent" />
                                <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-10">
                                    <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.4)' }}>{n(0)}</p>
                                    <h3 className={`text-white text-2xl md:text-4xl lg:text-5xl font-black leading-none tracking-tight max-w-lg ${headingFontClass}`}>
                                        {hero.name}
                                    </h3>
                                    <div className="flex items-center gap-3 mt-4">
                                        {yr(hero.date) && <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{yr(hero.date)}</span>}
                                        <span className="text-xs font-bold px-3 py-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                                            style={{ backgroundColor: accent, color: accentContrast }}>
                                            View Gallery ↗
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </Link>
                    </motion.div>

                    {/* Numbered strip */}
                    {strip.length > 0 && (
                        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(strip.length, 5)}, minmax(0, 1fr))` }}>
                            {strip.map((item, i) => (
                                <motion.div key={item.id} {...fadeUp(0.1 + i * 0.07)}>
                                    <Link href={`/e/${item.slug}/gallery`} className="block group">
                                        <div className="aspect-[3/4] relative rounded-xl overflow-hidden mb-2.5">
                                            {item.thumbnail && (
                                                <Image src={item.thumbnail} alt={item.name} fill
                                                    className="object-cover transition-transform duration-500 group-hover:scale-105" />
                                            )}
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-300" />
                                        </div>
                                        <p className="text-[9px] font-bold uppercase tracking-widest mb-0.5" style={{ color: t.muted }}>{n(i + 1)}</p>
                                        <p className="text-xs font-bold truncate" style={{ color: t.text }}>{item.name}</p>
                                    </Link>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>
            </section>
        );
    }

    return null;
}
