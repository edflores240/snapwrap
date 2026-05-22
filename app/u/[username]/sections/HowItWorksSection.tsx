'use client';

import { motion } from 'framer-motion';
import type { ThemeColors } from '@/lib/color-utils';

interface HowItWorksSectionProps {
    accent: string;
    accentContrast: string;
    t: ThemeColors;
    headingFontClass: string;
    variant?: 'steps' | 'timeline' | 'numbered';
}

const STEPS = [
    {
        number: '01',
        title: 'Pick Your Package',
        body: 'Browse our services, choose the package that fits your event, and lock in your date in minutes.',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
                <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
            </svg>
        ),
    },
    {
        number: '02',
        title: 'We Handle Setup',
        body: 'Our team arrives early, sets up the full booth experience, and makes sure everything is perfect before your guests arrive.',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
                <circle cx="12" cy="12" r="3" /><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72 1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </svg>
        ),
    },
    {
        number: '03',
        title: 'Your Guests Shine',
        body: 'Strike a pose, grab some props, and let the fun unfold. Instant prints and digital copies — no waiting.',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" />
            </svg>
        ),
    },
    {
        number: '04',
        title: 'Gallery Delivered',
        body: 'Your full digital gallery lands in your inbox the same day — download, share, and relive every moment.',
        icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
                <polyline points="8 17 12 21 16 17" /><line x1="12" y1="12" x2="12" y2="21" /><path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29" />
            </svg>
        ),
    },
];

function SectionHeader({ accent, t, headingFontClass }: { accent: string; t: ThemeColors; headingFontClass: string }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.5 }}
            className="mb-14"
        >
            <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: accent }}>
                The Process
            </p>
            <h2 className={`text-3xl md:text-4xl font-black ${headingFontClass}`} style={{ color: t.text }}>
                How it works
            </h2>
        </motion.div>
    );
}

function BookCTA({ accent, accentContrast }: { accent: string; accentContrast: string }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.45 }}
            className="mt-14 flex justify-center"
        >
            <a href="#contact"
                className="px-8 py-3.5 rounded-full text-sm font-bold transition-all hover:opacity-90 hover:scale-[1.02] active:scale-100"
                style={{ backgroundColor: accent, color: accentContrast }}>
                Book Your Date
            </a>
        </motion.div>
    );
}

export default function HowItWorksSection({ accent, accentContrast, t, headingFontClass, variant = 'steps' }: HowItWorksSectionProps) {

    if (variant === 'timeline') {
        return (
            <section className="py-20 px-4 md:px-10" style={{ backgroundColor: t.bg }}>
                <div className="max-w-3xl mx-auto">
                    <SectionHeader accent={accent} t={t} headingFontClass={headingFontClass} />

                    <div className="relative">
                        {/* Vertical connector */}
                        <div className="absolute left-5 top-5 bottom-8 w-px" style={{ backgroundColor: t.border }} />

                        {STEPS.map((step, i) => (
                            <motion.div
                                key={step.number}
                                initial={{ opacity: 0, x: -20 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.5, delay: i * 0.1 }}
                                className="relative flex gap-8 mb-10 last:mb-0"
                            >
                                <div className="w-10 h-10 rounded-full flex items-center justify-center z-10 shrink-0 border-2"
                                    style={{ backgroundColor: t.surface, borderColor: accent }}>
                                    <span className="text-xs font-black" style={{ color: accent }}>{step.number}</span>
                                </div>
                                <div className="pt-1.5 pb-2">
                                    <h3 className={`text-lg font-black mb-1.5 ${headingFontClass}`} style={{ color: t.text }}>
                                        {step.title}
                                    </h3>
                                    <p className="text-sm leading-relaxed" style={{ color: t.muted }}>
                                        {step.body}
                                    </p>
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    <BookCTA accent={accent} accentContrast={accentContrast} />
                </div>
            </section>
        );
    }

    if (variant === 'numbered') {
        return (
            <section className="py-20 px-4 md:px-10" style={{ backgroundColor: t.bg }}>
                <div className="max-w-7xl mx-auto">
                    <SectionHeader accent={accent} t={t} headingFontClass={headingFontClass} />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-10">
                        {STEPS.map((step, i) => (
                            <motion.div
                                key={step.number}
                                initial={{ opacity: 0, y: 24 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.5, delay: i * 0.1 }}
                                className="flex gap-5 items-start"
                            >
                                <span className={`text-7xl font-black leading-none flex-shrink-0 select-none ${headingFontClass}`}
                                    style={{ color: accent, opacity: 0.18 }}>
                                    {step.number}
                                </span>
                                <div className="pt-3">
                                    <h3 className={`text-lg font-black mb-2 ${headingFontClass}`} style={{ color: t.text }}>
                                        {step.title}
                                    </h3>
                                    <p className="text-sm leading-relaxed" style={{ color: t.muted }}>
                                        {step.body}
                                    </p>
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    <BookCTA accent={accent} accentContrast={accentContrast} />
                </div>
            </section>
        );
    }

    // steps (default)
    return (
        <section className="py-20 px-4 md:px-10" style={{ backgroundColor: t.bg }}>
            <div className="max-w-7xl mx-auto">
                <SectionHeader accent={accent} t={t} headingFontClass={headingFontClass} />

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative">
                    {/* Connector line — desktop only */}
                    <div className="hidden lg:block absolute top-10 left-[12.5%] right-[12.5%] h-px" style={{ backgroundColor: t.border, zIndex: 0 }} />

                    {STEPS.map((step, i) => (
                        <motion.div
                            key={step.number}
                            initial={{ opacity: 0, y: 28 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, delay: i * 0.1 }}
                            className="relative z-10 flex flex-col"
                        >
                            <div className="w-20 h-20 rounded-full flex items-center justify-center mb-5 border-2 shrink-0"
                                style={{ backgroundColor: t.surface, borderColor: t.border }}>
                                <div style={{ color: accent }}>{step.icon}</div>
                            </div>

                            <p className="font-mono text-[10px] uppercase tracking-[0.25em] mb-2" style={{ color: accent }}>
                                Step {step.number}
                            </p>

                            <h3 className={`text-lg font-black mb-2 ${headingFontClass}`} style={{ color: t.text }}>
                                {step.title}
                            </h3>
                            <p className="text-sm leading-relaxed" style={{ color: t.muted }}>
                                {step.body}
                            </p>
                        </motion.div>
                    ))}
                </div>

                <BookCTA accent={accent} accentContrast={accentContrast} />
            </div>
        </section>
    );
}
