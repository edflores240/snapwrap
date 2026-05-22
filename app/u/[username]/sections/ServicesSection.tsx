'use client';

import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { ServicePackage } from '@/lib/auth';
import { ThemeColors } from '@/lib/color-utils';

interface ServicesProps {
    services: ServicePackage[];
    accent: string;
    accentContrast: string;
    t: ThemeColors;
    headingFontClass: string;
    variant: string;
}

const FadeUp = ({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) => (
    <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
        className={className}
    >
        {children}
    </motion.div>
);

function SectionHeader({ t, headingFontClass }: { t: ThemeColors; headingFontClass: string }) {
    return (
        <FadeUp className="mb-12">
            <p className="text-xs font-black uppercase tracking-[0.2em] mb-2" style={{ color: t.muted }}>Packages</p>
            <h2 className={`text-3xl md:text-4xl font-black tracking-tight ${headingFontClass}`}>Services &amp; Pricing</h2>
        </FadeUp>
    );
}

function CardsVariant({ services, accent, accentContrast, t }: ServicesProps) {
    return (
        <section className="py-20 px-4 md:px-10" style={{ background: t.bg }}>
            <div className="max-w-5xl mx-auto">
                <SectionHeader t={t} headingFontClass="" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {services.map((service, i) => {
                        const isFeatured = services.length >= 2 && i === 1;
                        return (
                            <FadeUp key={service.id} delay={i * 0.1}>
                                <div
                                    className="relative rounded-3xl p-7 flex flex-col gap-5 border h-full"
                                    style={{
                                        background: isFeatured ? accent : t.surface,
                                        color: isFeatured ? accentContrast : t.text,
                                        borderColor: t.border,
                                    }}
                                >
                                    {isFeatured && (
                                        <div
                                            className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest"
                                            style={{ background: accentContrast, color: accent }}
                                        >
                                            Most Popular
                                        </div>
                                    )}
                                    <p
                                        className="text-xs font-black uppercase tracking-[0.15em]"
                                        style={{ opacity: 0.5 }}
                                    >
                                        Package {String(i + 1).padStart(2, '0')}
                                    </p>
                                    <div>
                                        <h3 className="text-xl font-black mb-1">{service.title}</h3>
                                        <p className="text-3xl font-black">{service.price}</p>
                                    </div>
                                    <p className="text-sm" style={{ opacity: 0.7 }}>{service.description}</p>
                                    <ul className="flex flex-col gap-2 mt-auto">
                                        {service.features.map((feature, fi) => (
                                            <li key={fi} className="flex items-start gap-2 text-sm">
                                                <Check
                                                    size={14}
                                                    className="mt-0.5 shrink-0"
                                                    style={{ opacity: 0.6, color: isFeatured ? accentContrast : accent }}
                                                />
                                                <span>{feature}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </FadeUp>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}

function RowsVariant({ services, accent, t, headingFontClass }: ServicesProps) {
    return (
        <section
            className="py-20 px-4 md:px-10 border-t border-b"
            style={{ background: t.surface, borderColor: t.border }}
        >
            <div className="max-w-4xl mx-auto">
                <SectionHeader t={t} headingFontClass={headingFontClass} />
                <div>
                    {services.map((service, i) => (
                        <FadeUp key={service.id} delay={i * 0.1}>
                            <div
                                className="flex flex-col md:flex-row py-8 gap-6 border-b last:border-0"
                                style={{ borderColor: t.border }}
                            >
                                <div className="md:w-1/3">
                                    <p className="text-5xl font-black" style={{ color: accent }}>{service.price}</p>
                                    <p className="text-lg font-black mt-1" style={{ color: t.text }}>{service.title}</p>
                                </div>
                                <div className="md:w-2/3">
                                    <p className="text-sm mb-4" style={{ color: t.muted }}>{service.description}</p>
                                    <ul className="flex flex-col gap-1.5">
                                        {service.features.map((feature, fi) => (
                                            <li key={fi} className="flex items-start gap-2 text-sm" style={{ color: t.text }}>
                                                <Check size={13} className="mt-0.5 shrink-0" style={{ color: accent, opacity: 0.8 }} />
                                                <span>{feature}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </FadeUp>
                    ))}
                </div>
            </div>
        </section>
    );
}

function MinimalVariant({ services, accent, t, headingFontClass }: ServicesProps) {
    return (
        <section className="py-20 px-4 md:px-10" style={{ background: t.bg }}>
            <div className="max-w-3xl mx-auto">
                <SectionHeader t={t} headingFontClass={headingFontClass} />
                <div>
                    {services.map((service, i) => (
                        <motion.div
                            key={service.id}
                            initial={{ opacity: 0, x: -24 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true, margin: '-40px' }}
                            transition={{ duration: 0.55, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
                            className="py-8 border-b"
                            style={{ borderColor: t.border }}
                        >
                            <p
                                className="text-xs font-black uppercase tracking-widest mb-3"
                                style={{ color: t.muted }}
                            >
                                {String(i + 1).padStart(2, '0')}
                            </p>
                            <div className="flex justify-between items-baseline gap-4 mb-2">
                                <h3 className="text-2xl font-black" style={{ color: t.text }}>{service.title}</h3>
                                <span className="text-2xl font-black shrink-0" style={{ color: accent }}>{service.price}</span>
                            </div>
                            <div
                                className="h-px w-full mb-3"
                                style={{ background: t.border }}
                            />
                            <p className="text-sm mb-2" style={{ color: t.muted }}>{service.description}</p>
                            <p className="text-xs" style={{ color: t.muted }}>
                                {service.features.join(' · ')}
                            </p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}

function PillarsVariant({ services, accent, accentContrast, t, headingFontClass }: ServicesProps) {
    const pillarHeights = ['280px', '360px', '320px'];

    return (
        <section className="py-20 px-4 md:px-10" style={{ background: t.surface }}>
            <div className="max-w-5xl mx-auto">
                <SectionHeader t={t} headingFontClass={headingFontClass} />
                <div className="flex flex-col md:flex-row md:items-end gap-5">
                    {services.map((service, i) => {
                        const isFeatured = services.length >= 2 && i === 1;
                        const minHeight = pillarHeights[i % pillarHeights.length];
                        return (
                            <FadeUp key={service.id} delay={i * 0.1} className="flex-1">
                                <div
                                    className="rounded-t-3xl border flex flex-col p-8 w-full"
                                    style={{
                                        minHeight: `clamp(200px, 100%, ${minHeight})`,
                                        background: isFeatured ? accent : t.card,
                                        color: isFeatured ? accentContrast : t.text,
                                        borderColor: t.border,
                                    }}
                                >
                                    <div
                                        className="h-1 w-full rounded-full mb-6"
                                        style={{ background: isFeatured ? accentContrast : accent, opacity: isFeatured ? 0.6 : 1 }}
                                    />
                                    <p
                                        className="text-xs font-black uppercase tracking-[0.15em] mb-4"
                                        style={{ opacity: 0.5 }}
                                    >
                                        {String(i + 1).padStart(2, '0')}
                                    </p>
                                    <h3 className="text-xl font-black mb-3">{service.title}</h3>
                                    <p className="text-4xl font-black mb-6">{service.price}</p>
                                    <ul className="flex flex-col gap-2 mt-auto">
                                        {service.features.map((feature, fi) => (
                                            <li key={fi} className="flex items-start gap-2 text-sm">
                                                <Check
                                                    size={13}
                                                    className="mt-0.5 shrink-0"
                                                    style={{ opacity: 0.7, color: isFeatured ? accentContrast : accent }}
                                                />
                                                <span>{feature}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </FadeUp>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}

function EditorialVariant({ services, accent, accentContrast, t, headingFontClass }: ServicesProps) {
    const [featured, ...rest] = services;

    return (
        <section className="py-20 px-4 md:px-10" style={{ background: t.bg }}>
            <div className="max-w-6xl mx-auto">
                <SectionHeader t={t} headingFontClass={headingFontClass} />
                <div className="flex flex-col md:flex-row gap-5">
                    {/* Featured card — left 2/3 */}
                    <FadeUp className="md:w-2/3">
                        <div
                            className="rounded-3xl p-10 h-full flex flex-col"
                            style={{ background: accent, color: accentContrast }}
                        >
                            <p
                                className="text-xs font-black uppercase tracking-[0.2em] mb-6"
                                style={{ opacity: 0.7 }}
                            >
                                Featured Package
                            </p>
                            <h3 className={`text-4xl font-black mb-2 ${headingFontClass}`}>{featured.title}</h3>
                            <p className="text-6xl font-black mb-6">{featured.price}</p>
                            <p className="text-base mb-8" style={{ opacity: 0.8 }}>{featured.description}</p>
                            <ul className="flex flex-col gap-3 mt-auto">
                                {featured.features.map((feature, fi) => (
                                    <li key={fi} className="flex items-start gap-3 text-sm">
                                        <Check size={15} className="mt-0.5 shrink-0" style={{ opacity: 0.7 }} />
                                        <span>{feature}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </FadeUp>

                    {/* Right column — 1/3 */}
                    {rest.length > 0 && (
                        <div className="md:w-1/3 flex flex-col gap-5">
                            {rest.map((service, i) => (
                                <FadeUp key={service.id} delay={(i + 1) * 0.1}>
                                    <div
                                        className="rounded-3xl p-6 flex flex-col gap-4 border"
                                        style={{ background: t.surface, borderColor: t.border, color: t.text }}
                                    >
                                        <div>
                                            <h3 className="text-lg font-black mb-1">{service.title}</h3>
                                            <p className="text-2xl font-black" style={{ color: accent }}>{service.price}</p>
                                        </div>
                                        <ul className="flex flex-col gap-1.5">
                                            {service.features.slice(0, 3).map((feature, fi) => (
                                                <li key={fi} className="flex items-start gap-2 text-xs" style={{ color: t.muted }}>
                                                    <Check size={11} className="mt-0.5 shrink-0" style={{ color: accent, opacity: 0.7 }} />
                                                    <span>{feature}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </FadeUp>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}

export default function ServicesSection(props: ServicesProps) {
    const { services, variant, headingFontClass } = props;

    if (services.length === 0) return null;

    // Pass headingFontClass into header via props spread — rebuild shared header inline per variant
    // to keep each variant self-contained with the correct headingFontClass.
    switch (variant) {
        case 'rows':
            return <RowsVariant {...props} />;
        case 'minimal':
            return <MinimalVariant {...props} />;
        case 'pillars':
            return <PillarsVariant {...props} />;
        case 'editorial':
            return <EditorialVariant {...props} />;
        case 'cards':
        default:
            return (
                <section className="py-20 px-4 md:px-10" style={{ background: props.t.bg }}>
                    <div className="max-w-5xl mx-auto">
                        <FadeUp className="mb-12">
                            <p className="text-xs font-black uppercase tracking-[0.2em] mb-2" style={{ color: props.t.muted }}>Packages</p>
                            <h2 className={`text-3xl md:text-4xl font-black tracking-tight ${headingFontClass}`}>Services &amp; Pricing</h2>
                        </FadeUp>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {services.map((service, i) => {
                                const isFeatured = services.length >= 2 && i === 1;
                                return (
                                    <FadeUp key={service.id} delay={i * 0.1}>
                                        <div
                                            className="relative rounded-3xl p-7 flex flex-col gap-5 border h-full"
                                            style={{
                                                background: isFeatured ? props.accent : props.t.surface,
                                                color: isFeatured ? props.accentContrast : props.t.text,
                                                borderColor: props.t.border,
                                            }}
                                        >
                                            {isFeatured && (
                                                <div
                                                    className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest"
                                                    style={{ background: props.accentContrast, color: props.accent }}
                                                >
                                                    Most Popular
                                                </div>
                                            )}
                                            <p className="text-xs font-black uppercase tracking-[0.15em]" style={{ opacity: 0.5 }}>
                                                Package {String(i + 1).padStart(2, '0')}
                                            </p>
                                            <div>
                                                <h3 className="text-xl font-black mb-1">{service.title}</h3>
                                                <p className="text-3xl font-black">{service.price}</p>
                                            </div>
                                            <p className="text-sm" style={{ opacity: 0.7 }}>{service.description}</p>
                                            <ul className="flex flex-col gap-2 mt-auto">
                                                {service.features.map((feature, fi) => (
                                                    <li key={fi} className="flex items-start gap-2 text-sm">
                                                        <Check
                                                            size={14}
                                                            className="mt-0.5 shrink-0"
                                                            style={{ opacity: 0.6, color: isFeatured ? props.accentContrast : props.accent }}
                                                        />
                                                        <span>{feature}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </FadeUp>
                                );
                            })}
                        </div>
                    </div>
                </section>
            );
    }
}
