'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useInView } from 'framer-motion';
import type { ThemeColors } from '@/lib/color-utils';

interface StatsSectionProps {
    accent: string;
    accentContrast: string;
    t: ThemeColors;
    headingFontClass: string;
    eventCount: number;
    reviewCount: number;
    avgRating: number;
    variant?: 'bar' | 'cards' | 'minimal';
}

function CountUp({ target, suffix, duration = 1600 }: { target: number; suffix: string; duration?: number }) {
    const [display, setDisplay] = useState(0);
    const ref = useRef<HTMLSpanElement>(null);
    const inView = useInView(ref, { once: true, margin: '-60px' });

    useEffect(() => {
        if (!inView) return;
        const start = performance.now();
        const tick = (now: number) => {
            const progress = Math.min((now - start) / duration, 1);
            const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
            setDisplay(Math.floor(eased * target));
            if (progress < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    }, [inView, target, duration]);

    return <span ref={ref}>{display}{suffix}</span>;
}

export default function StatsSection({
    accent, t, headingFontClass,
    eventCount, reviewCount, avgRating, variant = 'bar',
}: StatsSectionProps) {
    const ref = useRef<HTMLDivElement>(null);
    const inView = useInView(ref, { once: true, margin: '-80px' });

    const stats = [
        { value: Math.max(eventCount, 50),  suffix: '+', label: 'Events Photographed' },
        { value: Math.max(reviewCount, 20), suffix: '+', label: 'Happy Clients'       },
        { value: avgRating,                  suffix: '★', label: 'Average Rating'      },
        { value: 100,                        suffix: '%', label: 'Satisfaction Rate'   },
    ];

    if (variant === 'cards') {
        return (
            <section ref={ref} style={{ backgroundColor: t.bg }} className="py-10">
                <div className="max-w-7xl mx-auto px-6 md:px-12 grid grid-cols-2 md:grid-cols-4 gap-3">
                    {stats.map((stat, i) => (
                        <motion.div
                            key={stat.label}
                            initial={{ opacity: 0, y: 20 }}
                            animate={inView ? { opacity: 1, y: 0 } : {}}
                            transition={{ duration: 0.5, delay: i * 0.1 }}
                            className="flex flex-col items-center text-center p-6 rounded-2xl border"
                            style={{ backgroundColor: t.surface, borderColor: t.border }}
                        >
                            <p className={`text-4xl md:text-5xl font-black tabular-nums leading-none mb-1.5 ${headingFontClass}`}
                                style={{ color: accent }}>
                                <CountUp target={stat.value} suffix={stat.suffix} />
                            </p>
                            <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: t.muted }}>
                                {stat.label}
                            </p>
                        </motion.div>
                    ))}
                </div>
            </section>
        );
    }

    if (variant === 'minimal') {
        return (
            <section ref={ref} style={{ backgroundColor: t.bg }} className="py-16">
                <div className="max-w-7xl mx-auto px-6 md:px-12 grid grid-cols-2 md:grid-cols-4 gap-8">
                    {stats.map((stat, i) => (
                        <motion.div
                            key={stat.label}
                            initial={{ opacity: 0, y: 20 }}
                            animate={inView ? { opacity: 1, y: 0 } : {}}
                            transition={{ duration: 0.5, delay: i * 0.1 }}
                            className="flex flex-col items-center text-center"
                        >
                            <p className={`text-5xl md:text-6xl font-black tabular-nums leading-none mb-2 ${headingFontClass}`}
                                style={{ color: accent }}>
                                <CountUp target={stat.value} suffix={stat.suffix} />
                            </p>
                            <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: t.muted }}>
                                {stat.label}
                            </p>
                        </motion.div>
                    ))}
                </div>
            </section>
        );
    }

    // bar (default)
    return (
        <section ref={ref} style={{ backgroundColor: t.surface, borderTop: `1px solid ${t.border}`, borderBottom: `1px solid ${t.border}` }}>
            <div className="max-w-7xl mx-auto px-6 md:px-12 py-12 grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-0 md:divide-x"
                style={{ '--tw-divide-opacity': 1 } as React.CSSProperties}>
                {stats.map((stat, i) => (
                    <motion.div
                        key={stat.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={inView ? { opacity: 1, y: 0 } : {}}
                        transition={{ duration: 0.5, delay: i * 0.1 }}
                        className="flex flex-col items-center text-center px-4"
                    >
                        <p className={`text-4xl md:text-5xl font-black tabular-nums leading-none mb-1.5 ${headingFontClass}`}
                            style={{ color: accent }}>
                            <CountUp target={stat.value} suffix={stat.suffix} />
                        </p>
                        <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: t.muted }}>
                            {stat.label}
                        </p>
                    </motion.div>
                ))}
            </div>
            <style>{`
                @media (min-width: 768px) {
                    .md\\:divide-x > * + * { border-left: 1px solid ${t.border}; }
                }
            `}</style>
        </section>
    );
}
