'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus } from 'lucide-react';
import type { ThemeColors } from '@/lib/color-utils';

interface FaqSectionProps {
    accent: string;
    accentContrast: string;
    t: ThemeColors;
    headingFontClass: string;
    name: string;
}

const FAQS = [
    {
        q: 'How far in advance should I book?',
        a: 'We recommend booking at least 4–6 weeks in advance to secure your date, especially for weekends and peak seasons. That said, reach out even if your event is coming up soon — we\'ll do our best to accommodate last-minute bookings.',
    },
    {
        q: 'What\'s included in the photo booth package?',
        a: 'Every package includes full setup and breakdown, a friendly on-site attendant, unlimited photo sessions during your rental period, a prop kit, and a digital gallery delivered the same day. Instant prints and custom overlays are available in select packages.',
    },
    {
        q: 'Do you travel to my venue?',
        a: 'Yes! We travel to venues across the area. Delivery fees may apply for locations beyond our standard service radius — just mention your venue when you get in touch and we\'ll confirm availability and any travel costs upfront.',
    },
    {
        q: 'How long does setup take?',
        a: 'Setup typically takes 45–60 minutes. We always arrive early so everything is ready before your guests do, and breakdown after is quick and seamless.',
    },
    {
        q: 'How do guests get their photos?',
        a: 'Guests can receive photos instantly via text or email directly from the booth. Your full event gallery is also uploaded and shared with you the same day so everyone can download their favourites.',
    },
    {
        q: 'Can I customise the photo layout or overlay?',
        a: 'Absolutely. We offer custom branded overlays, layouts, and print designs. Share your event theme or brand colours and we\'ll create something that fits perfectly.',
    },
];

function FaqItem({
    faq, accent, t, open, onToggle,
}: {
    faq: { q: string; a: string };
    accent: string;
    t: ThemeColors;
    open: boolean;
    onToggle: () => void;
}) {
    return (
        <div className="border-b" style={{ borderColor: t.border }}>
            <button
                onClick={onToggle}
                className="w-full flex items-center justify-between gap-4 py-5 text-left"
            >
                <span className="text-sm md:text-base font-bold leading-snug" style={{ color: t.text }}>
                    {faq.q}
                </span>
                <span className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-colors"
                    style={{ backgroundColor: open ? accent : t.surface, color: open ? t.bg : t.muted, border: `1px solid ${open ? accent : t.border}` }}>
                    {open ? <Minus size={13} /> : <Plus size={13} />}
                </span>
            </button>

            <AnimatePresence initial={false}>
                {open && (
                    <motion.div
                        key="answer"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.28, ease: 'easeInOut' }}
                        style={{ overflow: 'hidden' }}
                    >
                        <p className="pb-5 text-sm leading-relaxed pr-10" style={{ color: t.muted }}>
                            {faq.a}
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default function FaqSection({ accent, accentContrast, t, headingFontClass, name }: FaqSectionProps) {
    const [openIndex, setOpenIndex] = useState<number | null>(0);

    return (
        <section className="py-20 px-4 md:px-10" style={{ backgroundColor: t.surface, borderTop: `1px solid ${t.border}` }}>
            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_1.6fr] gap-14">

                {/* Left — heading + CTA */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }} transition={{ duration: 0.5 }}
                    className="lg:sticky lg:top-24 lg:self-start"
                >
                    <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: accent }}>
                        FAQ
                    </p>
                    <h2 className={`text-3xl md:text-4xl font-black mb-4 ${headingFontClass}`} style={{ color: t.text }}>
                        Common questions
                    </h2>
                    <p className="text-sm leading-relaxed mb-8" style={{ color: t.muted }}>
                        Everything you need to know before booking. Still have a question?
                    </p>
                    <a href="#contact"
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold transition-all hover:opacity-90"
                        style={{ backgroundColor: accent, color: accentContrast }}>
                        Ask {name.split(' ')[0]}
                    </a>
                </motion.div>

                {/* Right — accordion */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.1 }}
                    className="border-t" style={{ borderColor: t.border }}
                >
                    {FAQS.map((faq, i) => (
                        <FaqItem
                            key={i}
                            faq={faq}
                            accent={accent}
                            t={t}
                            open={openIndex === i}
                            onToggle={() => setOpenIndex(openIndex === i ? null : i)}
                        />
                    ))}
                </motion.div>
            </div>
        </section>
    );
}
