'use client';

import { motion } from 'framer-motion';
import { ArrowUpRight, Globe, Mail, Phone, Link as LinkIcon } from 'lucide-react';
import { InstagramIcon, FacebookIcon, TwitterIcon, YoutubeIcon, LinkedinIcon, TiktokIcon } from '@/components/SocialIcons';
import type { SocialLinks, CustomLink } from '@/lib/auth';
import { resolveCustomLinkHref } from '@/lib/auth';
import type { ThemeColors } from '@/lib/color-utils';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ContactProps {
    name: string;
    website: string | null;
    social: SocialLinks;
    customLinks?: CustomLink[];
    accent: string;
    accentContrast: string;
    t: ThemeColors;
    headingFontClass: string;
    fontClass: string;
    variant: string;
}

interface ContactItem {
    href: string;
    icon: React.ReactNode;
    label: string;
    handle: string;
}

// ── Icon resolver ─────────────────────────────────────────────────────────────

function resolveIcon(icon: string, size = 20): React.ReactNode {
    switch (icon) {
        case 'instagram': return <InstagramIcon size={size} />;
        case 'facebook':  return <FacebookIcon  size={size} />;
        case 'youtube':   return <YoutubeIcon   size={size} />;
        case 'linkedin':  return <LinkedinIcon  size={size} />;
        case 'twitter':   return <TwitterIcon   size={size} />;
        case 'tiktok':    return <TiktokIcon    size={size} />;
        case 'email':     return <Mail          size={size} />;
        case 'phone':     return <Phone         size={size} />;
        case 'website':   return <Globe         size={size} />;
        default:          return <LinkIcon      size={size} />;
    }
}

// ── Build contact items from custom links or fallback to legacy social ─────────

function buildContactItems(
    customLinks: CustomLink[] | undefined,
    social: SocialLinks,
    website: string | null,
): ContactItem[] {
    if (customLinks && customLinks.length > 0) {
        return customLinks.map(l => ({
            href: resolveCustomLinkHref(l.icon, l.url),
            icon: resolveIcon(l.icon),
            label: l.label,
            handle: (l.icon === 'phone' || l.icon === 'email')
                ? l.url
                : l.url.replace(/^https?:\/\//, ''),
        }));
    }
    // legacy fallback
    const items: ContactItem[] = [];
    if (website) items.push({ href: website, icon: <Globe size={20} />, label: 'Website', handle: website.replace(/^https?:\/\//, '') });
    if (social.instagram) items.push({ href: `https://instagram.com/${social.instagram}`, icon: resolveIcon('instagram'), label: 'Instagram', handle: `@${social.instagram}` });
    if (social.facebook)  items.push({ href: `https://facebook.com/${social.facebook}`,   icon: resolveIcon('facebook'),  label: 'Facebook',  handle: social.facebook });
    if (social.tiktok)    items.push({ href: `https://tiktok.com/@${social.tiktok}`,       icon: resolveIcon('tiktok'),    label: 'TikTok',    handle: `@${social.tiktok}` });
    if (social.twitter)   items.push({ href: `https://twitter.com/${social.twitter}`,      icon: resolveIcon('twitter'),   label: 'Twitter',   handle: `@${social.twitter}` });
    return items;
}

// ── Shared sub-components ─────────────────────────────────────────────────────

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

// ── Variant: centered ─────────────────────────────────────────────────────────

function ContactCentered(props: ContactProps) {
    const { customLinks, social, website, accent, accentContrast, t, headingFontClass } = props;
    const items = buildContactItems(customLinks, social, website);
    const primary = items[0];
    const secondary = items[1];

    return (
        <section id="contact" className="py-24 px-4 md:px-10 border-t" style={{ borderColor: t.border }}>
            <FadeUp className="max-w-2xl mx-auto text-center space-y-8">
                <p className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: t.muted }}>Get in touch</p>
                <h2 className={`text-4xl md:text-5xl font-black tracking-tight ${headingFontClass}`} style={{ color: t.text }}>
                    Ready to book?
                </h2>
                <p className="leading-relaxed" style={{ color: t.muted }}>
                    Reach out to discuss your event, availability, and packages.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-4">
                    {primary && (
                        <a href={primary.href} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-2 px-8 py-4 rounded-full font-bold transition-all hover:-translate-y-0.5"
                            style={{ backgroundColor: accent, color: accentContrast }}>
                            {primary.label} <ArrowUpRight size={16} />
                        </a>
                    )}
                    {secondary && (
                        <a href={secondary.href} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-2 px-8 py-4 rounded-full font-bold border transition-all hover:-translate-y-0.5"
                            style={{ backgroundColor: t.surface, color: t.text, borderColor: t.border }}>
                            {secondary.icon} {secondary.label}
                        </a>
                    )}
                </div>
                {items.length > 2 && (
                    <div className="flex flex-wrap justify-center gap-3 pt-2">
                        {items.slice(2).map((item, i) => (
                            <a key={i} href={item.href} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1.5 text-sm font-semibold transition-all hover:opacity-70"
                                style={{ color: t.muted }}>
                                {item.icon} {item.label}
                            </a>
                        ))}
                    </div>
                )}
            </FadeUp>
        </section>
    );
}

// ── Variant: banner ───────────────────────────────────────────────────────────

function ContactBanner(props: ContactProps) {
    const { customLinks, social, website, accent, accentContrast, t, headingFontClass } = props;
    const items = buildContactItems(customLinks, social, website);
    const ctaBg = accentContrast === '#ffffff' ? '#ffffff' : '#171717';

    return (
        <section id="contact" className="relative overflow-hidden py-24 px-8 md:px-16" style={{ backgroundColor: accent }}>
            <FadeUp className="max-w-3xl mx-auto text-center space-y-8">
                <p className="text-xs font-black uppercase tracking-[0.2em] opacity-70" style={{ color: accentContrast }}>Get in touch</p>
                <h2 className={`text-5xl md:text-7xl font-black tracking-tighter leading-none ${headingFontClass}`} style={{ color: accentContrast }}>
                    Let&apos;s work together
                </h2>
                <p className="text-lg leading-relaxed opacity-80" style={{ color: accentContrast }}>
                    Reach out to discuss your event, availability, and packages.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-4">
                    {items[0] && (
                        <a href={items[0].href} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-2 px-8 py-4 rounded-full font-bold transition-all hover:-translate-y-0.5"
                            style={{ backgroundColor: ctaBg, color: accent }}>
                            {items[0].label} <ArrowUpRight size={16} />
                        </a>
                    )}
                    <div className="flex items-center gap-3">
                        {items.slice(1).map((item, i) => (
                            <a key={i} href={item.href} target="_blank" rel="noopener noreferrer"
                                className="w-11 h-11 rounded-full flex items-center justify-center transition-all hover:scale-110"
                                style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: accentContrast }}
                                aria-label={item.label}>
                                {item.icon}
                            </a>
                        ))}
                    </div>
                </div>
            </FadeUp>
        </section>
    );
}

// ── Variant: split ────────────────────────────────────────────────────────────

function ContactSplit(props: ContactProps) {
    const { customLinks, social, website, accent, accentContrast, t, headingFontClass } = props;
    const items = buildContactItems(customLinks, social, website);

    return (
        <section id="contact" className="py-20 px-4 md:px-10 border-t" style={{ borderColor: t.border }}>
            <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16">
                <FadeUp className="space-y-6">
                    <p className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: t.muted }}>Contact</p>
                    <h2 className={`text-4xl font-black tracking-tight leading-tight ${headingFontClass}`} style={{ color: t.text }}>
                        Let&apos;s create something together
                    </h2>
                    <p className="leading-relaxed" style={{ color: t.muted }}>
                        Reach out to discuss your event, availability, and packages.
                    </p>
                    {items[0] && (
                        <a href={items[0].href} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all hover:-translate-y-0.5"
                            style={{ backgroundColor: accent, color: accentContrast }}>
                            {items[0].label} <ArrowUpRight size={15} />
                        </a>
                    )}
                </FadeUp>
                <FadeUp delay={0.15} className="space-y-3">
                    {items.map((item, i) => (
                        <a key={i} href={item.href} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-4 rounded-xl p-4 border transition-all hover:-translate-y-0.5 group"
                            style={{ backgroundColor: t.card, borderColor: t.border, color: t.text }}>
                            <span style={{ color: t.muted }}>{item.icon}</span>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: t.muted }}>{item.label}</p>
                                <p className="font-bold truncate">{item.handle}</p>
                            </div>
                            <ArrowUpRight size={16} style={{ color: t.muted }} className="flex-shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                        </a>
                    ))}
                </FadeUp>
            </div>
        </section>
    );
}

// ── Variant: card ─────────────────────────────────────────────────────────────

function ContactCard(props: ContactProps) {
    const { name, customLinks, social, website, accent, accentContrast, t, headingFontClass } = props;
    const items = buildContactItems(customLinks, social, website);

    return (
        <section id="contact" className="py-20 px-4 md:px-10">
            <FadeUp className="max-w-2xl mx-auto">
                <div className="rounded-3xl p-10 border shadow-lg space-y-8" style={{ backgroundColor: t.surface, borderColor: t.border }}>
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: accent }}>
                            <span className="text-xl font-black" style={{ color: accentContrast }}>
                                {name.charAt(0).toUpperCase()}
                            </span>
                        </div>
                        <div>
                            <p className={`text-lg font-black leading-tight ${headingFontClass}`} style={{ color: t.text }}>{name}</p>
                            <p className="text-sm" style={{ color: t.muted }}>Let&apos;s work together</p>
                        </div>
                    </div>
                    <hr style={{ borderColor: t.border }} />
                    <div>
                        {items.map((item, i) => (
                            <a key={i} href={item.href} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-4 py-3 border-b last:border-0 transition-opacity hover:opacity-70 group"
                                style={{ borderColor: t.border, color: t.text }}>
                                <span className="flex-shrink-0" style={{ color: t.muted }}>{item.icon}</span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold uppercase tracking-wider mb-0.5" style={{ color: t.muted }}>{item.label}</p>
                                    <p className="font-bold truncate">{item.handle}</p>
                                </div>
                                <ArrowUpRight size={15} style={{ color: t.muted }} className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </a>
                        ))}
                    </div>
                    {items.length > 0 && (
                        <a href={items[0].href} target="_blank" rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl font-bold transition-all hover:opacity-90 hover:-translate-y-0.5"
                            style={{ backgroundColor: accent, color: accentContrast }}>
                            Get in Touch <ArrowUpRight size={16} />
                        </a>
                    )}
                </div>
            </FadeUp>
        </section>
    );
}

// ── Variant: minimal ──────────────────────────────────────────────────────────

function ContactMinimal(props: ContactProps) {
    const { name, customLinks, social, website, t, headingFontClass } = props;
    const items = buildContactItems(customLinks, social, website);

    return (
        <section id="contact" className="py-16 px-4 md:px-10 border-t" style={{ borderColor: t.border }}>
            <FadeUp className="flex flex-wrap items-center justify-between gap-6">
                <p className={`font-black text-xl tracking-tight ${headingFontClass}`} style={{ color: t.text }}>{name}</p>
                <div className="flex flex-wrap items-center gap-6">
                    {items.map((item, i) => (
                        <a key={i} href={item.href} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-sm font-bold transition-all hover:underline"
                            style={{ color: t.muted }}>
                            {item.icon} {item.label} <ArrowUpRight size={13} />
                        </a>
                    ))}
                </div>
            </FadeUp>
        </section>
    );
}

// ── Default export ────────────────────────────────────────────────────────────

export default function ContactSection(props: ContactProps) {
    switch (props.variant) {
        case 'banner':  return <ContactBanner  {...props} />;
        case 'split':   return <ContactSplit   {...props} />;
        case 'card':    return <ContactCard    {...props} />;
        case 'minimal': return <ContactMinimal {...props} />;
        default:        return <ContactCentered {...props} />;
    }
}
