'use client';

import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Star, Quote } from 'lucide-react';
import { ThemeColors } from '@/lib/color-utils';

interface Testimonial {
    id: string;
    author: string;
    role?: string;
    company?: string;
    text: string;
    rating?: number;
}

// Internal props used by variant sub-components
interface VariantProps {
    testimonials: Testimonial[];
    accent: string;
    accentContrast: string;
    t: ThemeColors;
    headingFontClass: string;
}

// Public props for the exported component
interface TestimonialsProps extends VariantProps {
    variant: string;
    username: string;
}

function StarRating({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'xs' }) {
    const iconSize = size === 'xs' ? 10 : 12;
    return (
        <div className="flex gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
                <Star
                    key={i}
                    size={iconSize}
                    className={i < rating ? 'fill-amber-400 text-amber-400' : 'fill-transparent text-amber-300'}
                />
            ))}
        </div>
    );
}

function AuthorAvatar({
    author,
    accent,
    accentContrast,
    size = 'sm',
}: {
    author: string;
    accent: string;
    accentContrast: string;
    size?: 'sm' | 'md';
}) {
    const dim = size === 'md' ? 'w-12 h-12 text-base' : 'w-8 h-8 text-xs';
    return (
        <div
            className={`${dim} rounded-full flex items-center justify-center font-bold flex-shrink-0`}
            style={{ backgroundColor: accent, color: accentContrast }}
        >
            {author.charAt(0).toUpperCase()}
        </div>
    );
}

function AuthorLine({
    testimonial,
    t,
    accent,
    accentContrast,
    centered = false,
    avatarSize = 'sm',
}: {
    testimonial: Testimonial;
    t: ThemeColors;
    accent: string;
    accentContrast: string;
    centered?: boolean;
    avatarSize?: 'sm' | 'md';
}) {
    const attribution = [testimonial.role, testimonial.company].filter(Boolean).join(', ');
    return (
        <div className={`flex items-center gap-3 ${centered ? 'justify-center' : ''}`}>
            <AuthorAvatar author={testimonial.author} accent={accent} accentContrast={accentContrast} size={avatarSize} />
            <div>
                <p className="text-sm font-bold" style={{ color: t.text }}>
                    {testimonial.author}
                </p>
                {attribution && (
                    <p className="text-xs" style={{ color: t.muted }}>
                        {attribution}
                    </p>
                )}
            </div>
        </div>
    );
}

function SectionHeader({
    t,
    accent,
    headingFontClass,
    centered = false,
}: {
    t: ThemeColors;
    accent: string;
    headingFontClass: string;
    centered?: boolean;
}) {
    return (
        <div className={`mb-10 ${centered ? 'text-center' : ''}`}>
            <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: accent }}>
                Testimonials
            </p>
            <h2 className={`text-3xl md:text-4xl font-black ${headingFontClass}`} style={{ color: t.text }}>
                What clients say
            </h2>
        </div>
    );
}

// ─── Grid ────────────────────────────────────────────────────────────────────

function GridVariant({ testimonials, accent, accentContrast, t, headingFontClass }: VariantProps) {
    return (
        <section
            className="py-20 px-4 md:px-10"
            style={{ backgroundColor: t.surface, borderTop: `1px solid ${t.border}`, borderBottom: `1px solid ${t.border}` }}
        >
            <div className="max-w-5xl mx-auto">
                <SectionHeader t={t} accent={accent} headingFontClass={headingFontClass} />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {testimonials.map((item, i) => (
                        <motion.div
                            key={item.id}
                            initial={{ opacity: 0, y: 24 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.45, delay: i * 0.08 }}
                            className="rounded-2xl p-6 border flex flex-col"
                            style={{ backgroundColor: t.card, borderColor: t.border }}
                        >
                            <div
                                className="text-5xl font-black leading-none mb-3 select-none"
                                style={{ color: accent }}
                                aria-hidden
                            >
                                &ldquo;
                            </div>
                            <p className="text-sm leading-relaxed flex-1 mb-4" style={{ color: t.muted }}>
                                {item.text}
                            </p>
                            <div className="flex flex-col gap-2 mt-auto">
                                {item.rating && <StarRating rating={item.rating} />}
                                <AuthorLine testimonial={item} t={t} accent={accent} accentContrast={accentContrast} />
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}

// ─── Carousel ────────────────────────────────────────────────────────────────

function CarouselVariant({ testimonials, accent, accentContrast, t, headingFontClass }: VariantProps) {
    const carouselRef = useRef<HTMLDivElement>(null);

    const scroll = (dir: 'left' | 'right') => {
        carouselRef.current?.scrollBy({ left: dir === 'right' ? 340 : -340, behavior: 'smooth' });
    };

    return (
        <section className="py-20 overflow-hidden" style={{ backgroundColor: t.bg }}>
            <div className="flex items-center justify-between px-4 md:px-10 mb-8">
                <div>
                    <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: accent }}>
                        Testimonials
                    </p>
                    <h2 className={`text-3xl md:text-4xl font-black ${headingFontClass}`} style={{ color: t.text }}>
                        What clients say
                    </h2>
                </div>
                <div className="flex gap-2">
                    {(['left', 'right'] as const).map((dir) => (
                        <button
                            key={dir}
                            onClick={() => scroll(dir)}
                            className="w-10 h-10 rounded-full border flex items-center justify-center transition-opacity hover:opacity-70"
                            style={{ borderColor: t.border, backgroundColor: t.surface, color: t.text }}
                            aria-label={dir === 'left' ? 'Scroll left' : 'Scroll right'}
                        >
                            {dir === 'left' ? '←' : '→'}
                        </button>
                    ))}
                </div>
            </div>

            <div
                ref={carouselRef}
                className="flex gap-5 pb-4 px-4 md:px-10"
                style={{
                    overflowX: 'auto',
                    scrollbarWidth: 'none',
                    scrollSnapType: 'x mandatory',
                }}
            >
                {testimonials.map((item, i) => (
                    <motion.div
                        key={item.id}
                        initial={{ opacity: 0, x: 40 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.45, delay: i * 0.08 }}
                        className="p-8 rounded-2xl border flex flex-col flex-shrink-0"
                        style={{
                            minWidth: 320,
                            scrollSnapAlign: 'start',
                            backgroundColor: t.surface,
                            borderColor: t.border,
                        }}
                    >
                        <div
                            className="text-6xl font-black leading-none mb-4 select-none"
                            style={{ color: accent }}
                            aria-hidden
                        >
                            &ldquo;
                        </div>
                        <p className="text-lg leading-relaxed flex-1 mb-6" style={{ color: t.text }}>
                            {item.text}
                        </p>
                        <div className="flex flex-col gap-1.5">
                            <p className="text-sm font-bold" style={{ color: t.text }}>
                                {item.author}
                            </p>
                            {(item.role || item.company) && (
                                <p className="text-xs" style={{ color: t.muted }}>
                                    {[item.role, item.company].filter(Boolean).join(', ')}
                                </p>
                            )}
                            {item.rating && <StarRating rating={item.rating} />}
                        </div>
                    </motion.div>
                ))}
            </div>
        </section>
    );
}

// ─── Marquee ─────────────────────────────────────────────────────────────────

function MarqueeVariant({ testimonials, accent, accentContrast, t, headingFontClass }: VariantProps) {
    const [hovered, setHovered] = useState(false);

    // Fall back to grid if fewer than 3 testimonials
    if (testimonials.length < 3) {
        return (
            <GridVariant
                testimonials={testimonials}
                accent={accent}
                accentContrast={accentContrast}
                t={t}
                headingFontClass={headingFontClass}
            />
        );
    }

    const doubled = [...testimonials, ...testimonials];
    const playState = hovered ? 'paused' : 'running';

    const MarqueeTrack = ({ reverse }: { reverse?: boolean }) => (
        <div className="overflow-hidden mb-4">
            <div
                className={reverse ? 'animate-marquee-reverse' : 'animate-marquee'}
                style={{ animationPlayState: playState }}
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
            >
                <div className="flex gap-4 w-max">
                    {doubled.map((item, i) => (
                        <div
                            key={`${item.id}-${i}`}
                            className="px-6 py-4 rounded-2xl border flex-shrink-0 max-w-xs"
                            style={{ backgroundColor: t.card, borderColor: t.border }}
                        >
                            <p className="text-sm leading-relaxed mb-2" style={{ color: t.muted }}>
                                &ldquo;{item.text.length > 80 ? item.text.slice(0, 80) + '...' : item.text}&rdquo;
                            </p>
                            <p className="text-xs font-bold" style={{ color: t.text }}>
                                {item.author}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    return (
        <section
            className="py-16 overflow-hidden"
            style={{ backgroundColor: t.surface, borderTop: `1px solid ${t.border}`, borderBottom: `1px solid ${t.border}` }}
        >
            <style>{`
                @keyframes marquee {
                    from { transform: translateX(0); }
                    to { transform: translateX(-50%); }
                }
                @keyframes marquee-reverse {
                    from { transform: translateX(-50%); }
                    to { transform: translateX(0); }
                }
                .animate-marquee {
                    animation: marquee 30s linear infinite;
                }
                .animate-marquee-reverse {
                    animation: marquee-reverse 30s linear infinite;
                }
            `}</style>
            <div className="text-center mb-10 px-4">
                <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: accent }}>
                    Testimonials
                </p>
                <h2 className={`text-3xl md:text-4xl font-black ${headingFontClass}`} style={{ color: t.text }}>
                    What clients say
                </h2>
            </div>
            <MarqueeTrack />
            <MarqueeTrack reverse />
        </section>
    );
}

// ─── Featured ────────────────────────────────────────────────────────────────

function FeaturedVariant({ testimonials, accent, accentContrast, t, headingFontClass }: VariantProps) {
    const [featured, ...rest] = testimonials;

    return (
        <section className="py-20 px-4 md:px-10" style={{ backgroundColor: t.bg }}>
            <div className="max-w-4xl mx-auto">
                <SectionHeader t={t} accent={accent} headingFontClass={headingFontClass} centered />

                {/* Featured card */}
                <motion.div
                    initial={{ opacity: 0, y: 32 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.55 }}
                    className="text-center mb-12"
                >
                    <div
                        className="text-8xl font-black leading-none mb-2 select-none"
                        style={{ color: accent }}
                        aria-hidden
                    >
                        &ldquo;
                    </div>
                    <p
                        className="text-2xl md:text-3xl italic leading-relaxed mb-8"
                        style={{ color: t.text }}
                    >
                        {featured.text}
                    </p>
                    <div className="flex flex-col items-center gap-3">
                        <AuthorLine
                            testimonial={featured}
                            t={t}
                            accent={accent}
                            accentContrast={accentContrast}
                            centered
                            avatarSize="md"
                        />
                        {featured.rating && (
                            <div className="flex justify-center">
                                <StarRating rating={featured.rating} />
                            </div>
                        )}
                    </div>
                </motion.div>

                {/* Remaining cards */}
                {rest.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        {rest.map((item, i) => (
                            <motion.div
                                key={item.id}
                                initial={{ opacity: 0, y: 24 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.45, delay: i * 0.1 }}
                                className="rounded-xl p-5 border"
                                style={{ backgroundColor: t.surface, borderColor: t.border }}
                            >
                                <p className="text-sm leading-relaxed mb-4" style={{ color: t.muted }}>
                                    &ldquo;{item.text}&rdquo;
                                </p>
                                <div className="flex flex-col gap-2">
                                    {item.rating && <StarRating rating={item.rating} />}
                                    <p className="text-sm font-bold" style={{ color: t.text }}>
                                        {item.author}
                                    </p>
                                    {(item.role || item.company) && (
                                        <p className="text-xs" style={{ color: t.muted }}>
                                            {[item.role, item.company].filter(Boolean).join(', ')}
                                        </p>
                                    )}
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}

// ─── Minimal ─────────────────────────────────────────────────────────────────

function MinimalVariant({ testimonials, accent, accentContrast, t, headingFontClass }: VariantProps) {
    return (
        <section className="py-20 px-4 md:px-10" style={{ backgroundColor: t.bg }}>
            <div className="max-w-3xl mx-auto">
                <SectionHeader t={t} accent={accent} headingFontClass={headingFontClass} />
                {testimonials.map((item, i) => {
                    const attribution = [item.role, item.company].filter(Boolean).join(', ');
                    return (
                        <motion.div
                            key={item.id}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.4, delay: i * 0.1 }}
                            className="border-l-2 pl-6 py-2 mb-8"
                            style={{ borderColor: accent }}
                        >
                            <p className="text-lg italic leading-relaxed mb-3" style={{ color: t.text }}>
                                &ldquo;{item.text}&rdquo;
                            </p>
                            <div className="flex items-center gap-3 flex-wrap">
                                <span className="text-sm font-black" style={{ color: t.text }}>
                                    {item.author}
                                </span>
                                {attribution && (
                                    <span className="text-xs" style={{ color: t.muted }}>
                                        &mdash; {attribution}
                                    </span>
                                )}
                                {item.rating && <StarRating rating={item.rating} size="xs" />}
                            </div>
                        </motion.div>
                    );
                })}
            </div>
        </section>
    );
}

// ─── Root export ─────────────────────────────────────────────────────────────

export default function TestimonialsSection({
    testimonials,
    accent,
    accentContrast,
    t,
    headingFontClass,
    variant,
    username,
}: TestimonialsProps) {
    const props = { testimonials, accent, accentContrast, t, headingFontClass };

    const reviewCTA = (
        <div style={{ backgroundColor: t.bg, borderTop: `1px solid ${t.border}` }}>
            <div className="max-w-7xl mx-auto px-6 md:px-12 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                    <p className="font-bold text-sm" style={{ color: t.text }}>Enjoyed the experience?</p>
                    <p className="text-xs mt-0.5" style={{ color: t.muted }}>Your review helps others discover us.</p>
                </div>
                <a href={`/u/${username}/review`}
                    className="flex-shrink-0 inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-bold transition-all hover:opacity-80 active:scale-95"
                    style={{ backgroundColor: accent, color: accentContrast }}>
                    <Star size={13} className="fill-current" />
                    Leave a Review
                </a>
            </div>
        </div>
    );

    if (testimonials.length === 0) {
        return (
            <>
                <section className="py-20 text-center" style={{ backgroundColor: t.surface, borderTop: `1px solid ${t.border}` }}>
                    <div className="max-w-md mx-auto px-6">
                        <Quote size={32} className="mx-auto mb-4 opacity-20" style={{ color: t.text }} />
                        <p className="font-bold text-base mb-1" style={{ color: t.text }}>No reviews yet</p>
                        <p className="text-sm" style={{ color: t.muted }}>Be the first to share your experience!</p>
                    </div>
                </section>
                {reviewCTA}
            </>
        );
    }

    let section: React.ReactNode;
    switch (variant) {
        case 'carousel':  section = <CarouselVariant  {...props} />; break;
        case 'marquee':   section = <MarqueeVariant   {...props} />; break;
        case 'featured':  section = <FeaturedVariant  {...props} />; break;
        case 'minimal':   section = <MinimalVariant   {...props} />; break;
        default:          section = <GridVariant       {...props} />;
    }

    return (
        <>
            {section}
            {reviewCTA}
        </>
    );
}
