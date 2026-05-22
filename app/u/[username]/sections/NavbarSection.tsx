'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Camera, Phone, Mail, MapPin, Search, Menu, X } from 'lucide-react';
import { InstagramIcon, FacebookIcon, TwitterIcon, YoutubeIcon, TiktokIcon } from '@/components/SocialIcons';
import type { ThemeColors } from '@/lib/color-utils';
import type { CustomLink } from '@/lib/auth';
import { resolveCustomLinkHref } from '@/lib/auth';

interface NavbarProps {
    name: string;
    username: string;
    website: string | null;
    location: string | null;
    logo_url: string | null;
    customLinks: CustomLink[];
    accent: string;
    accentContrast: string;
    t: ThemeColors;
    headingFontClass: string;
    variant: string;
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

const NAV_LINKS = [
    { label: 'Portfolio', href: '#portfolio' },
    { label: 'Services',  href: '#services'  },
    { label: 'Contact',   href: '#contact'   },
];

function LogoMark({ logo_url, name, accent, accentContrast, size = 32 }: {
    logo_url: string | null; name: string; accent: string; accentContrast: string; size?: number;
}) {
    if (logo_url) {
        return (
            <Image src={logo_url} alt={name} width={size} height={size}
                className="rounded-lg object-cover flex-shrink-0"
                style={{ width: size, height: size }} />
        );
    }
    return (
        <div className="rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ width: size, height: size, backgroundColor: accent }}>
            <Camera size={Math.round(size * 0.46)} style={{ color: accentContrast }} />
        </div>
    );
}

function SocialChip({ icon, href }: { icon: string; href: string }) {
    const size = 14;
    const node = (() => {
        switch (icon) {
            case 'instagram': return <InstagramIcon size={size} />;
            case 'facebook':  return <FacebookIcon  size={size} />;
            case 'twitter':   return <TwitterIcon   size={size} />;
            case 'youtube':   return <YoutubeIcon   size={size} />;
            case 'tiktok':    return <TiktokIcon    size={size} />;
            default: return null;
        }
    })();
    if (!node) return null;
    return (
        <a href={href} target="_blank" rel="noopener noreferrer"
            className="w-7 h-7 rounded-full border flex items-center justify-center transition-all hover:scale-110"
            style={{ borderColor: 'currentColor', opacity: 0.7 }}>
            {node}
        </a>
    );
}

// ─── Brand name — clamps font size + truncates so long names never overflow ────

function BrandName({ name, className = '', style = {} }: {
    name: string; className?: string; style?: React.CSSProperties;
}) {
    return (
        <span
            className={`font-black tracking-tight leading-tight break-words ${className}`}
            style={{
                maxWidth: 'clamp(80px, 28vw, 210px)',
                fontSize: 'clamp(0.65rem, 2vw, 0.875rem)',
                wordBreak: 'break-word',
                ...style,
            }}
        >
            {name}
        </span>
    );
}

function extractContact(customLinks: CustomLink[]) {
    const phone   = customLinks.find(l => l.icon === 'phone');
    const email   = customLinks.find(l => l.icon === 'email');
    const socials = customLinks.filter(l => ['instagram','facebook','twitter','youtube','tiktok'].includes(l.icon));
    return { phone, email, socials };
}

// ─── Variant 1: Classic ───────────────────────────────────────────────────────
// Single clean row — logo left, nav links center, accent CTA + phone right.

function ClassicNav({ name, website, logo_url, customLinks, accent, accentContrast, t, headingFontClass }: NavbarProps) {
    const { phone } = extractContact(customLinks);
    const [open, setOpen] = useState(false);
    return (
        <header className="sticky top-0 z-40 bg-white border-b shadow-sm" style={{ borderColor: t.border }}>
            <div className="flex items-center justify-between px-4 md:px-10 py-4" style={{ backgroundColor: t.surface }}>
                {/* Logo */}
                <div className="flex items-center gap-3 min-w-0 flex-shrink">
                    <LogoMark logo_url={logo_url} name={name} accent={accent} accentContrast={accentContrast} size={36} />
                    <BrandName name={name} className={headingFontClass} style={{ color: t.text }} />
                </div>
                {/* Center nav */}
                <nav className="hidden md:flex items-center gap-7">
                    {NAV_LINKS.map(l => (
                        <a key={l.href} href={l.href} className="text-sm font-semibold transition-opacity hover:opacity-60" style={{ color: t.text }}>{l.label}</a>
                    ))}
                </nav>
                {/* CTA */}
                <div className="flex items-center gap-3">
                    {phone && (
                        <a href={resolveCustomLinkHref('phone', phone.url)} className="hidden lg:flex items-center gap-1.5 text-sm font-bold" style={{ color: accent }}>
                            <Phone size={14} /> {phone.label}
                        </a>
                    )}
                    <a href={website || '#contact'} target={website ? '_blank' : undefined} rel="noopener noreferrer"
                        className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-sm transition-all hover:opacity-90"
                        style={{ backgroundColor: accent, color: accentContrast }}>
                        Book Now
                    </a>
                    <button className="md:hidden p-2" onClick={() => setOpen(v => !v)} style={{ color: t.text }}>
                        {open ? <X size={20} /> : <Menu size={20} />}
                    </button>
                </div>
            </div>
            {/* Mobile menu */}
            {open && (
                <div className="md:hidden px-4 pb-4 pt-2 border-t space-y-2" style={{ backgroundColor: t.surface, borderColor: t.border }}>
                    {NAV_LINKS.map(l => (
                        <a key={l.href} href={l.href} onClick={() => setOpen(false)}
                            className="block py-2 text-sm font-semibold border-b" style={{ color: t.text, borderColor: t.border }}>{l.label}</a>
                    ))}
                </div>
            )}
        </header>
    );
}

// ─── Variant 2: Double Row ────────────────────────────────────────────────────
// Row 1: Logo + angled accent divider + contact right.
// Row 2: Accent background — nav links + search icon.

function DoubleRowNav({ name, website, logo_url, customLinks, accent, accentContrast, t, headingFontClass }: NavbarProps) {
    const { phone, socials } = extractContact(customLinks);
    const [open, setOpen] = useState(false);
    return (
        <header className="sticky top-0 z-40 shadow-md" style={{ backgroundColor: t.surface }}>
            {/* Row 1 */}
            <div className="flex items-center justify-between px-4 md:px-10 py-3 border-b" style={{ borderColor: t.border }}>
                <div className="flex items-center gap-3 min-w-0 flex-shrink">
                    <LogoMark logo_url={logo_url} name={name} accent={accent} accentContrast={accentContrast} size={38} />
                    <BrandName name={name} className={headingFontClass} style={{ color: t.text }} />
                </div>
                {/* Angled accent accent strip — decorative */}
                <div className="hidden md:block flex-1 mx-8 h-10 relative overflow-hidden rounded-sm"
                    style={{ background: `linear-gradient(100deg, ${accent} 60%, transparent 100%)` }} />
                <div className="flex items-center gap-4">
                    {phone && (
                        <a href={resolveCustomLinkHref('phone', phone.url)} className="flex items-center gap-2 text-sm font-bold" style={{ color: t.text }}>
                            <span className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: accent }}>
                                <Phone size={13} style={{ color: accentContrast }} />
                            </span>
                            <span style={{ color: t.text }}>{phone.label}</span>
                        </a>
                    )}
                    {!phone && (
                        <a href={website || '#contact'} className="flex items-center gap-2 text-sm font-bold" style={{ color: t.text }}>
                            <span className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: accent }}>
                                <Phone size={13} style={{ color: accentContrast }} />
                            </span>
                            Book Now
                        </a>
                    )}
                </div>
            </div>
            {/* Row 2 — accent nav bar */}
            <div className="hidden md:flex items-center justify-between px-4 md:px-10 py-0" style={{ backgroundColor: accent }}>
                <nav className="flex items-center">
                    {NAV_LINKS.map((l, i) => (
                        <a key={l.href} href={l.href}
                            className={`px-5 py-3 text-sm font-bold tracking-wide transition-all hover:opacity-80 ${i === 0 ? 'border-r' : ''}`}
                            style={{ color: accentContrast, borderColor: `${accentContrast}30` }}>
                            {l.label}
                        </a>
                    ))}
                    <a href="#portfolio" className="px-5 py-3 text-sm font-bold tracking-wide transition-all hover:opacity-80" style={{ color: accentContrast }}>Gallery</a>
                </nav>
                <div className="flex items-center gap-3 py-2" style={{ color: accentContrast }}>
                    {socials.slice(0, 3).map(s => <SocialChip key={s.id} icon={s.icon} href={s.url} />)}
                    <button className="w-8 h-8 rounded-full border flex items-center justify-center hover:opacity-80" style={{ borderColor: `${accentContrast}50`, color: accentContrast }}>
                        <Search size={13} />
                    </button>
                </div>
            </div>
            {/* Mobile toggle */}
            <div className="md:hidden flex items-center justify-end px-4 py-2" style={{ backgroundColor: accent }}>
                <button onClick={() => setOpen(v => !v)} style={{ color: accentContrast }}>{open ? <X size={20} /> : <Menu size={20} />}</button>
            </div>
            {open && (
                <div className="md:hidden px-4 pb-4 space-y-1" style={{ backgroundColor: accent }}>
                    {[...NAV_LINKS, { label: 'Reviews', href: '#testimonials' }].map(l => (
                        <a key={l.href} href={l.href} onClick={() => setOpen(false)}
                            className="block py-2.5 text-sm font-bold border-b" style={{ color: accentContrast, borderColor: `${accentContrast}30` }}>{l.label}</a>
                    ))}
                </div>
            )}
        </header>
    );
}

// ─── Variant 3: Magazine ──────────────────────────────────────────────────────
// Row 1: Social icons left, logo center, Book Now right.
// Row 2: Accent background — section nav + search.

function MagazineNav({ name, website, logo_url, customLinks, accent, accentContrast, t, headingFontClass }: NavbarProps) {
    const { socials } = extractContact(customLinks);
    const [open, setOpen] = useState(false);
    return (
        <header className="sticky top-0 z-40 shadow-sm" style={{ backgroundColor: t.surface }}>
            {/* Row 1 */}
            <div className="flex items-center justify-between px-4 md:px-8 py-3 border-b" style={{ borderColor: t.border }}>
                <div className="flex items-center gap-2" style={{ color: t.muted }}>
                    {socials.length > 0
                        ? socials.slice(0, 4).map(s => <SocialChip key={s.id} icon={s.icon} href={s.url} />)
                        : <span className="text-xs font-semibold" style={{ color: t.muted }}>Follow us</span>
                    }
                </div>
                <div className="flex items-center gap-2.5 min-w-0 flex-shrink">
                    <LogoMark logo_url={logo_url} name={name} accent={accent} accentContrast={accentContrast} size={32} />
                    <BrandName name={name} className={headingFontClass} style={{ color: t.text }} />
                </div>
                <div className="flex items-center gap-3">
                    <a href={website || '#contact'} target={website ? '_blank' : undefined} rel="noopener noreferrer"
                        className="hidden sm:inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold rounded-full border-2 transition-all hover:opacity-80"
                        style={{ borderColor: accent, color: accent }}>
                        Book Now
                    </a>
                    <button className="md:hidden p-2" onClick={() => setOpen(v => !v)} style={{ color: t.text }}>
                        {open ? <X size={20} /> : <Menu size={20} />}
                    </button>
                </div>
            </div>
            {/* Row 2 — accent strip */}
            <div className="hidden md:flex items-center justify-between px-4 md:px-8 py-0" style={{ backgroundColor: accent }}>
                <nav className="flex items-center">
                    {[...NAV_LINKS, { label: 'Reviews', href: '#testimonials' }].map(l => (
                        <a key={l.href} href={l.href}
                            className="px-4 py-2.5 text-xs font-black uppercase tracking-wider transition-all hover:opacity-70"
                            style={{ color: accentContrast }}>
                            {l.label}
                        </a>
                    ))}
                </nav>
                <button className="w-7 h-7 rounded-full flex items-center justify-center my-1.5" style={{ backgroundColor: `${accentContrast}22`, color: accentContrast }}>
                    <Search size={13} />
                </button>
            </div>
            {open && (
                <div className="md:hidden border-t" style={{ backgroundColor: t.surface, borderColor: t.border }}>
                    {NAV_LINKS.map(l => (
                        <a key={l.href} href={l.href} onClick={() => setOpen(false)}
                            className="block px-4 py-3 text-sm font-semibold border-b" style={{ color: t.text, borderColor: t.border }}>{l.label}</a>
                    ))}
                </div>
            )}
        </header>
    );
}

// ─── Variant 4: Corporate ─────────────────────────────────────────────────────
// Row 1: Logo + location / phone / email info strip.
// Row 2: Socials left, nav links center-right, Get Quote CTA.

function CorporateNav({ name, website, location, logo_url, customLinks, accent, accentContrast, t, headingFontClass }: NavbarProps) {
    const { phone, email, socials } = extractContact(customLinks);
    const [open, setOpen] = useState(false);
    return (
        <header className="sticky top-0 z-40 shadow-md">
            {/* Row 1 — info bar */}
            <div className="hidden md:flex items-center gap-8 px-4 md:px-10 py-3 border-b" style={{ backgroundColor: t.surface, borderColor: t.border }}>
                <div className="flex items-center gap-3 min-w-0 flex-shrink">
                    <LogoMark logo_url={logo_url} name={name} accent={accent} accentContrast={accentContrast} size={40} />
                    <BrandName name={name} className={headingFontClass} style={{ color: t.text }} />
                </div>
                <div className="flex items-center gap-6 ml-auto">
                    {location && (
                        <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: t.muted }}>
                            <MapPin size={12} style={{ color: accent }} /> {location}
                        </span>
                    )}
                    {phone && (
                        <a href={resolveCustomLinkHref('phone', phone.url)} className="flex items-center gap-1.5 text-xs font-medium transition-colors hover:opacity-70" style={{ color: t.muted }}>
                            <Phone size={12} style={{ color: accent }} /> {phone.label}
                        </a>
                    )}
                    {email && (
                        <a href={email.url} className="flex items-center gap-1.5 text-xs font-medium transition-colors hover:opacity-70" style={{ color: t.muted }}>
                            <Mail size={12} style={{ color: accent }} /> {email.label}
                        </a>
                    )}
                </div>
            </div>
            {/* Row 2 — accent nav */}
            <div className="flex items-center justify-between px-4 md:px-10 py-0" style={{ backgroundColor: accent }}>
                <div className="flex items-center gap-2 py-2" style={{ color: accentContrast }}>
                    {socials.slice(0, 4).map(s => <SocialChip key={s.id} icon={s.icon} href={s.url} />)}
                </div>
                <nav className="hidden md:flex items-center">
                    {[...NAV_LINKS, { label: 'Reviews', href: '#testimonials' }].map(l => (
                        <a key={l.href} href={l.href}
                            className="px-4 py-3.5 text-xs font-black uppercase tracking-wider border-r transition-all hover:opacity-70"
                            style={{ color: accentContrast, borderColor: `${accentContrast}25` }}>
                            {l.label}
                        </a>
                    ))}
                    <a href={website || '#contact'} target={website ? '_blank' : undefined} rel="noopener noreferrer"
                        className="ml-2 my-2 flex items-center gap-2 px-5 py-2 text-xs font-black uppercase tracking-wider rounded-sm transition-all hover:opacity-90"
                        style={{ backgroundColor: accentContrast, color: accent }}>
                        Get Quote →
                    </a>
                </nav>
                {/* Mobile */}
                <button className="md:hidden p-3" onClick={() => setOpen(v => !v)} style={{ color: accentContrast }}>
                    {open ? <X size={20} /> : <Menu size={20} />}
                </button>
            </div>
            {open && (
                <div className="md:hidden" style={{ backgroundColor: accent }}>
                    {NAV_LINKS.map(l => (
                        <a key={l.href} href={l.href} onClick={() => setOpen(false)}
                            className="block px-4 py-3 text-sm font-bold border-t" style={{ color: accentContrast, borderColor: `${accentContrast}25` }}>{l.label}</a>
                    ))}
                </div>
            )}
        </header>
    );
}

// ─── Variant 5: Utility ───────────────────────────────────────────────────────
// Row 1: Thin accent strip — phone + email left, social follow right.
// Row 2: Dark bar — logo left, nav center, outline CTA right.

function UtilityNav({ name, website, logo_url, customLinks, accent, accentContrast, t, headingFontClass }: NavbarProps) {
    const { phone, email, socials } = extractContact(customLinks);
    const [open, setOpen] = useState(false);
    const darkBg = '#1a1a1a';
    return (
        <header className="sticky top-0 z-40 shadow-lg">
            {/* Row 1 — thin info strip */}
            <div className="hidden md:flex items-center justify-between px-4 md:px-10 py-1.5" style={{ backgroundColor: accent }}>
                <div className="flex items-center gap-5">
                    {phone && (
                        <a href={resolveCustomLinkHref('phone', phone.url)} className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: accentContrast }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accentContrast }} />
                            {phone.label}
                        </a>
                    )}
                    {email && (
                        <a href={email.url} className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: accentContrast }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accentContrast }} />
                            {email.label}
                        </a>
                    )}
                    {!phone && !email && (
                        <span className="text-xs font-semibold" style={{ color: accentContrast }}>Professional Photo Booth Services</span>
                    )}
                </div>
                {socials.length > 0 && (
                    <div className="flex items-center gap-2" style={{ color: accentContrast }}>
                        <span className="text-xs font-bold mr-1" style={{ color: accentContrast, opacity: 0.8 }}>Follow us:</span>
                        {socials.slice(0, 4).map(s => <SocialChip key={s.id} icon={s.icon} href={s.url} />)}
                    </div>
                )}
            </div>
            {/* Row 2 — dark main nav */}
            <div className="flex items-center justify-between px-4 md:px-10 py-4" style={{ backgroundColor: darkBg }}>
                <div className="flex items-center gap-3 min-w-0 flex-shrink">
                    <LogoMark logo_url={logo_url} name={name} accent={accent} accentContrast={accentContrast} size={34} />
                    <BrandName name={name} className={`${headingFontClass} text-white`} />
                </div>
                <nav className="hidden md:flex items-center gap-6">
                    {NAV_LINKS.map(l => (
                        <a key={l.href} href={l.href}
                            className="text-sm font-semibold text-white/70 transition-colors hover:text-white">
                            {l.label}
                        </a>
                    ))}
                    <a href="#portfolio" className="text-sm font-semibold text-white/70 transition-colors hover:text-white">Gallery</a>
                </nav>
                <div className="flex items-center gap-3">
                    <a href={website || '#contact'} target={website ? '_blank' : undefined} rel="noopener noreferrer"
                        className="hidden sm:inline-flex px-5 py-2 text-sm font-bold rounded-sm border-2 transition-all hover:opacity-80"
                        style={{ borderColor: accentContrast, color: accentContrast }}>
                        Book Now
                    </a>
                    <button className="md:hidden p-2 text-white" onClick={() => setOpen(v => !v)}>
                        {open ? <X size={20} /> : <Menu size={20} />}
                    </button>
                </div>
            </div>
            {open && (
                <div className="md:hidden border-t border-white/10" style={{ backgroundColor: darkBg }}>
                    {NAV_LINKS.map(l => (
                        <a key={l.href} href={l.href} onClick={() => setOpen(false)}
                            className="block px-4 py-3 text-sm font-semibold text-white/80 border-b border-white/10">{l.label}</a>
                    ))}
                    <div className="p-4">
                        <a href={website || '#contact'} className="block text-center py-2.5 text-sm font-bold border-2 rounded-sm" style={{ borderColor: accentContrast, color: accentContrast }}>
                            Book Now
                        </a>
                    </div>
                </div>
            )}
        </header>
    );
}

// ─── Router ───────────────────────────────────────────────────────────────────

export default function NavbarSection(props: NavbarProps) {
    switch (props.variant) {
        case 'double':    return <DoubleRowNav  {...props} />;
        case 'magazine':  return <MagazineNav   {...props} />;
        case 'corporate': return <CorporateNav  {...props} />;
        case 'utility':   return <UtilityNav    {...props} />;
        default:          return <ClassicNav    {...props} />;
    }
}
