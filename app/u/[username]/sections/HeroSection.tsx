'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import { MapPin, Globe, Link as LinkIcon } from 'lucide-react';
import { InstagramIcon, FacebookIcon, TwitterIcon, YoutubeIcon, LinkedinIcon, TiktokIcon } from '@/components/SocialIcons';
import type { ThemeColors } from '@/lib/color-utils';
import type { SocialLinks, CustomLink } from '@/lib/auth';

interface HeroSectionProps {
    name: string;
    bio: string | null;
    location: string | null;
    website: string | null;
    logo_url: string | null;
    social: SocialLinks;
    customLinks?: CustomLink[];
    accent: string;
    accentContrast: string;
    t: ThemeColors;
    headingFontClass: string;
    fontClass: string;
    variant: string;
    heroBg?: string;
}

// ─── Background preset system ─────────────────────────────────────────────────

function getHeroBgStyle(preset: string | undefined, accent: string): React.CSSProperties {
    switch (preset) {
        case 'gradient-warm':
            return { background: `radial-gradient(ellipse at 30% 20%, ${accent}55 0%, transparent 60%), linear-gradient(135deg, #f59e0b22 0%, #ef444422 50%, #ec489922 100%)` };
        case 'gradient-aurora':
            return { background: 'linear-gradient(135deg, #10b98133 0%, #0d948133 30%, #6366f133 70%, #8b5cf633 100%)' };
        case 'gradient-midnight':
            return { background: 'linear-gradient(160deg, #1e1b4b 0%, #0f172a 50%, #020617 100%)' };
        case 'gradient-sunset':
            return { background: 'linear-gradient(135deg, #f9731644 0%, #ec489944 40%, #f4338344 100%)' };
        case 'mesh': {
            const a = `${accent}33`;
            return { background: `radial-gradient(ellipse at 0% 0%, ${a} 0%, transparent 50%), radial-gradient(ellipse at 100% 0%, #6366f133 0%, transparent 50%), radial-gradient(ellipse at 100% 100%, #ec489933 0%, transparent 50%), radial-gradient(ellipse at 0% 100%, #10b98133 0%, transparent 50%)` };
        }
        case 'geometric':
            return {
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='${encodeURIComponent(accent)}' fill-opacity='0.08'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            };
        case 'noise':
            return {
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.07'/%3E%3C/svg%3E")`,
                backgroundSize: '256px 256px',
            };
        default:
            return {};
    }
}

// ─── Particle background ──────────────────────────────────────────────────────

function ParticlesBg({ accent }: { accent: string }) {
    return (
        <>
            <style>{`
                @keyframes float-particle {
                    0%, 100% { transform: translateY(0) scale(1); opacity: 0.6; }
                    50% { transform: translateY(-30px) scale(1.2); opacity: 0.2; }
                }
                .snapwrap-particle { animation: float-particle var(--dur, 6s) ease-in-out infinite; }
            `}</style>
            {Array.from({ length: 18 }).map((_, i) => (
                <span key={i} className="snapwrap-particle absolute rounded-full pointer-events-none"
                    style={{
                        width: `${4 + (i % 4) * 4}px`, height: `${4 + (i % 4) * 4}px`,
                        left: `${(i * 17 + 7) % 100}%`, top: `${(i * 23 + 5) % 100}%`,
                        backgroundColor: accent, opacity: 0.3,
                        ['--dur' as string]: `${4 + (i % 5)}s`,
                        animationDelay: `${(i * 0.4) % 3}s`,
                    }}
                />
            ))}
        </>
    );
}

// ─── Social icon helper ───────────────────────────────────────────────────────

function SocialIcon({ icon, size = 16 }: { icon: string; size?: number }) {
    switch (icon) {
        case 'instagram': return <InstagramIcon size={size} />;
        case 'facebook':  return <FacebookIcon  size={size} />;
        case 'youtube':   return <YoutubeIcon   size={size} />;
        case 'linkedin':  return <LinkedinIcon  size={size} />;
        case 'twitter':   return <TwitterIcon   size={size} />;
        case 'tiktok':    return <TiktokIcon    size={size} />;
        default:          return <LinkIcon      size={size} />;
    }
}

// ─── Avatar component ─────────────────────────────────────────────────────────

function Avatar({ logo_url, name, accent, accentContrast, size = 96 }: {
    logo_url: string | null; name: string; accent: string; accentContrast: string; size?: number;
}) {
    if (logo_url) {
        return (
            <Image src={logo_url} alt={name} width={size} height={size}
                className="rounded-2xl object-cover flex-shrink-0"
                style={{ width: size, height: size }} />
        );
    }
    return (
        <div className="rounded-2xl flex items-center justify-center font-bold flex-shrink-0"
            style={{ width: size, height: size, backgroundColor: accent, color: accentContrast, fontSize: size * 0.35 }}>
            {name.charAt(0).toUpperCase()}
        </div>
    );
}

// ─── Link chips ───────────────────────────────────────────────────────────────

function LinkChips({ customLinks, social, accent, accentContrast: _ac, t }: {
    customLinks: CustomLink[] | undefined; social: SocialLinks; accent: string; accentContrast: string; t: ThemeColors;
}) {
    const links: CustomLink[] = customLinks && customLinks.length > 0 ? customLinks : [
        ...(social.instagram ? [{ id: 'ig', label: 'Instagram', url: social.instagram, icon: 'instagram' as const }] : []),
        ...(social.facebook  ? [{ id: 'fb', label: 'Facebook',  url: social.facebook,  icon: 'facebook'  as const }] : []),
        ...(social.tiktok    ? [{ id: 'tt', label: 'TikTok',    url: social.tiktok,    icon: 'tiktok'    as const }] : []),
        ...(social.twitter   ? [{ id: 'tw', label: 'Twitter',   url: social.twitter,   icon: 'twitter'   as const }] : []),
    ];
    if (links.length === 0) return null;
    return (
        <div className="flex flex-wrap gap-2 mt-4">
            {links.slice(0, 5).map(link => (
                <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-opacity hover:opacity-75 border"
                    style={{ borderColor: t.border, color: t.text }}>
                    <SocialIcon icon={link.icon} size={12} />
                    {link.label}
                </a>
            ))}
        </div>
    );
}

// ─── Helper: detect dark bg ───────────────────────────────────────────────────

function bgIsDark(color: string): boolean {
    let r = 0, g = 0, b = 0;
    if (color.startsWith('#')) {
        r = parseInt(color.slice(1, 3), 16) || 0;
        g = parseInt(color.slice(3, 5), 16) || 0;
        b = parseInt(color.slice(5, 7), 16) || 0;
    } else {
        // handles rgb(r, g, b) format
        const m = color.match(/\d+/g);
        if (m) { r = +m[0]; g = +m[1]; b = +m[2]; }
    }
    return (r * 299 + g * 587 + b * 114) / 1000 < 128;
}

// ─── Variant: Serenity — iridescent ribbon + editorial text ───────────────────

function IridescentRibbon({ dark }: { dark: boolean }) {
    const op = dark ? 0.28 : 0.6;
    return (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {/* Large back blob */}
            <div className="absolute" style={{
                top: '-35%', right: '-15%', width: '88%', height: '175%',
                background: 'linear-gradient(140deg, #c7d2fe 0%, #818cf8 18%, #c4b5fd 38%, #f0abfc 56%, #7dd3fc 74%, #bfdbfe 90%)',
                borderRadius: '42% 58% 65% 35% / 38% 42% 58% 62%',
                opacity: op,
                transform: 'rotate(-10deg)',
                filter: 'blur(0.5px)',
            }} />
            {/* Mid ribbon */}
            <div className="absolute" style={{
                top: '5%', right: '5%', width: '72%', height: '122%',
                background: 'linear-gradient(175deg, rgba(255,255,255,0.9) 0%, #a5b4fc 12%, #c4b5fd 32%, #f9a8d4 52%, #818cf8 72%, rgba(255,255,255,0.5) 90%)',
                borderRadius: '62% 38% 32% 68% / 58% 68% 32% 42%',
                opacity: op * 0.8,
                transform: 'rotate(8deg)',
                filter: 'blur(1px)',
            }} />
            {/* Glass highlight */}
            <div className="absolute" style={{
                top: '-10%', right: '22%', width: '50%', height: '88%',
                background: 'linear-gradient(110deg, rgba(255,255,255,0.95) 0%, rgba(196,181,253,0.55) 35%, rgba(165,180,252,0.4) 60%, transparent 80%)',
                borderRadius: '50% 50% 42% 58% / 42% 58% 48% 52%',
                opacity: dark ? 0.18 : 0.82,
                transform: 'rotate(-5deg)',
                filter: 'blur(2px)',
            }} />
            {/* Bottom wrap */}
            <div className="absolute" style={{
                bottom: '-25%', right: '8%', width: '65%', height: '88%',
                background: 'linear-gradient(55deg, #c4b5fd 0%, #818cf8 22%, #bfdbfe 46%, #c7d2fe 70%)',
                borderRadius: '32% 68% 58% 42% / 68% 32% 68% 32%',
                opacity: op * 0.6,
                transform: 'rotate(14deg)',
                filter: 'blur(1.5px)',
            }} />
        </div>
    );
}

function GlassmorphismHero(props: HeroSectionProps) {
    const { name, bio, location, logo_url, accent, accentContrast, t, headingFontClass, heroBg } = props;

    const isDark  = bgIsDark(t.bg);
    const bgStyle = getHeroBgStyle(heroBg, accent);

    // Veil that blends with t.bg so text is legible over the ribbon
    const veil = isDark
        ? 'linear-gradient(90deg, rgba(10,10,10,0.88) 0%, rgba(10,10,10,0.52) 48%, transparent 78%)'
        : 'linear-gradient(90deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.55) 48%, transparent 76%)';

    // All text/UI colours come from the theme
    const tagBorder = `${accent}55`;
    const tagBg     = `${accent}18`;
    const tagText   = accent;
    const cardBg    = isDark ? `${t.surface}cc` : `${t.surface}cc`;

    const words      = name.split(' ');
    const mid        = Math.ceil(words.length / 2);
    const topLine    = words.slice(0, mid).join(' ');
    const bottomLine = words.slice(mid).join(' ');

    const tags = ['Photo Booth', ...(location ? [location] : []), 'Events'];

    return (
        <section className="relative overflow-hidden min-h-[420px] max-h-[680px] flex items-center"
            style={{ background: t.bg, ...bgStyle }}>

            {heroBg === 'particles' && <ParticlesBg accent={accent} />}
            <IridescentRibbon dark={isDark} />

            {/* Left readability veil */}
            <div className="absolute inset-0 pointer-events-none" style={{ background: veil }} />

            {/* Main text */}
            <div className="relative z-10 w-full max-w-7xl mx-auto px-6 md:px-12 py-16">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>

                    <h1 className={`text-[clamp(2.8rem,11vw,7.5rem)] font-black leading-none uppercase tracking-tight mb-1 ${headingFontClass}`}
                        style={{ color: t.text }}>
                        {topLine}
                    </h1>

                    {bottomLine ? (
                        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2 mb-2">
                            <span className={`text-[clamp(2.2rem,8.5vw,6rem)] font-black italic leading-none tracking-tight ${headingFontClass}`}
                                style={{ color: t.text, opacity: 0.72 }}>
                                {bottomLine}
                            </span>
                            <div className="flex flex-wrap gap-2 pb-1">
                                {tags.map(tag => (
                                    <span key={tag} className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border"
                                        style={{ borderColor: tagBorder, backgroundColor: tagBg, color: tagText }}>
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-wrap gap-2 mt-3">
                            {tags.map(tag => (
                                <span key={tag} className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border"
                                    style={{ borderColor: tagBorder, backgroundColor: tagBg, color: tagText }}>
                                    {tag}
                                </span>
                            ))}
                        </div>
                    )}
                </motion.div>
            </div>

            {/* Floating bio card */}
            <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.35 }}
                className="absolute bottom-6 right-6 md:right-10 z-20 w-full max-w-[260px] rounded-2xl p-4 border shadow-2xl"
                style={{ backgroundColor: cardBg, borderColor: t.border, backdropFilter: 'blur(20px)' }}>
                <div className="flex items-center gap-2.5 mb-2.5">
                    <Avatar logo_url={logo_url} name={name} accent={accent} accentContrast={accentContrast} size={36} />
                    <div className="min-w-0">
                        <p className="text-xs font-black uppercase tracking-wide truncate" style={{ color: t.text }}>{name}</p>
                        {location && (
                            <p className="text-[10px] flex items-center gap-0.5 truncate" style={{ color: t.muted }}>
                                <MapPin size={9} />{location}
                            </p>
                        )}
                    </div>
                </div>
                {bio && (
                    <p className="text-[11px] leading-relaxed mb-3" style={{ color: t.muted,
                        display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {bio}
                    </p>
                )}
                <a href="#contact" className="block text-center text-xs font-bold py-2 rounded-full transition-opacity hover:opacity-80"
                    style={{ backgroundColor: accent, color: accentContrast }}>
                    Book Now
                </a>
            </motion.div>
        </section>
    );
}

// ─── Variant: Split ───────────────────────────────────────────────────────────

function SplitHero(props: HeroSectionProps) {
    const { name, bio, location, website, logo_url, social, customLinks, accent, accentContrast, t, headingFontClass, heroBg } = props;
    const bgStyle = getHeroBgStyle(heroBg, accent);
    return (
        <section className="relative overflow-hidden min-h-[420px] max-h-[680px] grid grid-cols-1 md:grid-cols-2">
            <div className="relative flex flex-col items-center justify-center px-8 py-20 md:py-0 overflow-hidden"
                style={{ background: accent, ...bgStyle }}>
                {heroBg === 'particles' && <ParticlesBg accent="#ffffff" />}
                <motion.div initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6 }}
                    className="relative z-10 flex flex-col items-center gap-6">
                    <Avatar logo_url={logo_url} name={name} accent={t.bg} accentContrast={accent} size={140} />
                    <div className="text-center">
                        <p className="text-sm font-semibold uppercase tracking-widest" style={{ color: `${accentContrast}88` }}>Photo Booth Studio</p>
                        {location && <p className="flex items-center justify-center gap-1 mt-2 text-sm" style={{ color: `${accentContrast}bb` }}><MapPin size={12} /> {location}</p>}
                    </div>
                </motion.div>
            </div>
            <div className="flex flex-col justify-center px-8 md:px-16 py-20 md:py-0" style={{ backgroundColor: t.surface }}>
                <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7, delay: 0.1 }}>
                    <h1 className={`text-4xl md:text-5xl lg:text-6xl font-black leading-none mb-4 ${headingFontClass}`} style={{ color: t.text }}>
                        {name}
                    </h1>
                    {bio && <p className="text-lg leading-relaxed mb-6 max-w-md" style={{ color: t.muted }}>{bio}</p>}
                    {website && (
                        <a href={website} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-2 text-sm font-semibold mb-6 hover:underline" style={{ color: accent }}>
                            <Globe size={15} /> {website}
                        </a>
                    )}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <a href="#contact" className="px-8 py-3 rounded-full text-sm font-bold text-center transition-opacity hover:opacity-80"
                            style={{ backgroundColor: accent, color: accentContrast }}>Get in Touch</a>
                        <a href="#portfolio" className="px-8 py-3 rounded-full text-sm font-bold text-center border transition-colors hover:opacity-70"
                            style={{ borderColor: t.border, color: t.text }}>View Work</a>
                    </div>
                    <LinkChips customLinks={customLinks} social={social} accent={accent} accentContrast={accentContrast} t={t} />
                </motion.div>
            </div>
        </section>
    );
}

// ─── Variant: Cinematic ───────────────────────────────────────────────────────

function CinematicHero(props: HeroSectionProps) {
    const { name, bio, location, website, logo_url, customLinks, accent, accentContrast, t, headingFontClass, heroBg } = props;
    const bgStyle = getHeroBgStyle(heroBg, accent);
    return (
        <section className="relative overflow-hidden min-h-[420px] max-h-[680px] flex items-end"
            style={{ background: heroBg === 'gradient-midnight' ? '#0f0a1a' : t.bg, ...bgStyle }}>
            {heroBg === 'particles' && <ParticlesBg accent={accent} />}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent z-10 pointer-events-none" />
            <div className="relative z-20 w-full max-w-7xl mx-auto px-6 pb-16 md:pb-24">
                <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
                    <div className="flex items-end gap-6 mb-4">
                        <Avatar logo_url={logo_url} name={name} accent={accent} accentContrast={accentContrast} size={64} />
                        <div>
                            {location && <p className="text-xs uppercase tracking-widest mb-1" style={{ color: '#ffffff88' }}><MapPin size={10} className="inline mr-1" />{location}</p>}
                            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: accent }}>Photo Booth Studio</p>
                        </div>
                    </div>
                    <h1 className={`text-[clamp(3rem,12vw,9rem)] font-black leading-none tracking-tighter text-white mb-4 ${headingFontClass}`}>
                        {name}
                    </h1>
                    {bio && <p className="max-w-xl text-base leading-relaxed mb-6" style={{ color: '#ffffffbb' }}>{bio}</p>}
                    <div className="flex flex-wrap items-center gap-4">
                        <a href="#contact" className="px-7 py-2.5 rounded-full text-sm font-bold transition-opacity hover:opacity-80"
                            style={{ backgroundColor: accent, color: accentContrast }}>Book Now</a>
                        {website && (
                            <a href={website} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1.5 text-sm font-semibold text-white hover:underline">
                                <Globe size={13} /> {website}
                            </a>
                        )}
                        {(customLinks ?? []).slice(0, 3).map(l => (
                            <a key={l.id} href={l.url} target="_blank" rel="noopener noreferrer"
                                className="text-white/60 hover:text-white transition-colors">
                                <SocialIcon icon={l.icon} size={18} />
                            </a>
                        ))}
                    </div>
                </motion.div>
            </div>
        </section>
    );
}

// ─── Variant: Editorial ───────────────────────────────────────────────────────

function EditorialHero(props: HeroSectionProps) {
    const { name, bio, location, website, logo_url, social, customLinks, accent, accentContrast, t, headingFontClass, heroBg } = props;
    const bgStyle = getHeroBgStyle(heroBg, accent);
    return (
        <section className="relative overflow-hidden min-h-[420px] max-h-[680px] flex items-center"
            style={{ background: t.bg, ...bgStyle }}>
            {heroBg === 'particles' && <ParticlesBg accent={accent} />}
            <div className="relative z-10 w-full max-w-7xl mx-auto px-6 md:px-12 grid grid-cols-1 md:grid-cols-[70%_30%] gap-8 py-24">
                <motion.div initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7 }}>
                    <p className="text-xs font-bold uppercase tracking-[0.3em] mb-6" style={{ color: accent }}>Photo Booth Studio</p>
                    <h1 className={`text-[clamp(3rem,10vw,8rem)] font-black leading-none tracking-tighter ${headingFontClass}`} style={{ color: t.text }}>
                        {name.split(' ').map((word, i) => (
                            <span key={i} className="block">{word}</span>
                        ))}
                    </h1>
                    {location && (
                        <p className="flex items-center gap-1.5 mt-6 text-sm" style={{ color: t.muted }}>
                            <MapPin size={13} /> {location}
                        </p>
                    )}
                </motion.div>
                <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7, delay: 0.15 }}
                    className="flex flex-col justify-end gap-6">
                    <Avatar logo_url={logo_url} name={name} accent={accent} accentContrast={accentContrast} size={80} />
                    {bio && <p className="text-sm leading-relaxed" style={{ color: t.muted }}>{bio}</p>}
                    <div className="flex flex-col gap-2">
                        <a href="#contact" className="text-center px-5 py-2.5 rounded-full text-sm font-bold transition-opacity hover:opacity-80"
                            style={{ backgroundColor: accent, color: accentContrast }}>Book Now</a>
                        {website && (
                            <a href={website} target="_blank" rel="noopener noreferrer"
                                className="flex items-center justify-center gap-1.5 text-xs font-semibold hover:underline" style={{ color: t.muted }}>
                                <Globe size={12} /> {website}
                            </a>
                        )}
                    </div>
                    <LinkChips customLinks={customLinks} social={social} accent={accent} accentContrast={accentContrast} t={t} />
                </motion.div>
            </div>
            <div className="absolute bottom-0 left-0 w-full h-0.5" style={{ backgroundColor: accent, opacity: 0.4 }} />
        </section>
    );
}

// ─── Variant: Studio — Anthropic-style clean editorial ────────────────────────

function StudioHero(props: HeroSectionProps) {
    const { name, bio, location, customLinks, accent, accentContrast, t, headingFontClass, heroBg } = props;

    const isDark = bgIsDark(t.bg);
    const bgStyle = getHeroBgStyle(heroBg, accent);

    const dotColor = isDark ? 'rgba(255,255,255,0.055)' : 'rgba(0,0,0,0.05)';

    const socials = (customLinks ?? []).filter(l =>
        ['instagram', 'facebook', 'twitter', 'tiktok', 'youtube', 'linkedin'].includes(l.icon)
    ).slice(0, 5);

    return (
        <section
            className="relative overflow-hidden min-h-[420px] max-h-[680px] flex items-center"
            style={{ background: t.bg, ...bgStyle }}
        >
            {/* Dot grid */}
            <div className="absolute inset-0 pointer-events-none" style={{
                backgroundImage: `radial-gradient(circle, ${dotColor} 1.5px, transparent 1.5px)`,
                backgroundSize: '26px 26px',
            }} />

            {/* Soft accent wash — top-left only */}
            <div className="absolute inset-0 pointer-events-none" style={{
                background: `radial-gradient(ellipse at 0% 0%, ${accent}1a 0%, transparent 52%)`,
            }} />

            <div className="relative z-10 w-full max-w-7xl mx-auto px-6 md:px-12 py-20 md:py-28">

                {/* Mono label row */}
                <motion.div
                    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
                    className="flex items-center gap-3 mb-10"
                >
                    <span className="block w-6 h-px flex-shrink-0" style={{ backgroundColor: accent }} />
                    <span className="font-mono text-[10px] uppercase tracking-[0.28em]" style={{ color: accent }}>
                        Photo Booth Studio
                    </span>
                    {location && (
                        <>
                            <span className="block w-px h-3 flex-shrink-0 opacity-25" style={{ backgroundColor: t.text }} />
                            <span className="font-mono text-[10px] uppercase tracking-widest flex items-center gap-1" style={{ color: t.muted }}>
                                <MapPin size={9} />{location}
                            </span>
                        </>
                    )}
                </motion.div>

                {/* Headline — one word per line so any name length fits */}
                <motion.h1
                    initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65, delay: 0.1 }}
                    className={`font-black leading-[0.92] tracking-tighter mb-6 ${headingFontClass}`}
                    style={{ color: t.text, fontSize: 'clamp(2.6rem, 9vw, 8rem)' }}
                >
                    {name.split(' ').map((word, i) => (
                        <span key={i} className="block" style={{
                            opacity: i % 2 === 1 ? 0.68 : 1,
                            fontStyle: i % 2 === 1 ? 'italic' : 'normal',
                        }}>
                            {word}
                        </span>
                    ))}
                </motion.h1>

                {/* Hairline rule */}
                <motion.div
                    initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.75, delay: 0.28, ease: 'easeOut' }}
                    style={{ transformOrigin: 'left', height: '1px', backgroundColor: t.border, marginBottom: '2rem' }}
                />

                {/* Bio + CTAs */}
                <motion.div
                    initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.42 }}
                    className="flex flex-col md:flex-row items-start md:items-end justify-between gap-8"
                >
                    <p className="max-w-lg text-base md:text-lg leading-relaxed" style={{ color: t.muted }}>
                        {bio || 'Creating unforgettable photo booth experiences for every occasion.'}
                    </p>

                    <div className="flex flex-wrap gap-3 flex-shrink-0">
                        <a href="#contact"
                            className="px-7 py-3 rounded-full text-sm font-bold transition-all hover:opacity-90 hover:scale-[1.02] active:scale-100"
                            style={{ backgroundColor: accent, color: accentContrast }}>
                            Book Now
                        </a>
                        <a href="#portfolio"
                            className="px-7 py-3 rounded-full text-sm font-bold border transition-all hover:opacity-70"
                            style={{ borderColor: t.border, color: t.text }}>
                            View Work
                        </a>
                    </div>
                </motion.div>

                {/* Social links */}
                {socials.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.58 }}
                        className="flex flex-wrap items-center gap-6 mt-10 pt-6 border-t"
                        style={{ borderColor: t.border }}
                    >
                        {socials.map(l => (
                            <a key={l.id} href={l.url} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider transition-opacity hover:opacity-100"
                                style={{ color: t.text, opacity: 0.45 }}>
                                <SocialIcon icon={l.icon} size={13} />
                                {l.label}
                            </a>
                        ))}
                    </motion.div>
                )}
            </div>
        </section>
    );
}

// ─── Variant: Floating ────────────────────────────────────────────────────────

function FloatingHero(props: HeroSectionProps) {
    const { name, bio, location, logo_url, social, customLinks, accent, accentContrast, t, headingFontClass, heroBg } = props;
    const bgStyle = getHeroBgStyle(heroBg, accent);
    return (
        <section className="relative overflow-hidden min-h-[420px] max-h-[680px] flex items-center justify-center px-4 py-16"
            style={{ background: t.bg, ...bgStyle }}>
            {heroBg === 'particles' && <ParticlesBg accent={accent} />}
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-center gap-6 md:gap-10 w-full max-w-3xl">
                <motion.div initial={{ opacity: 0, rotate: -8, y: 20 }} animate={{ opacity: 1, rotate: -4, y: 0 }} transition={{ duration: 0.6 }}
                    className="rounded-3xl p-4 shadow-2xl flex-shrink-0 border"
                    style={{ backgroundColor: t.surface, borderColor: t.border }}>
                    <Avatar logo_url={logo_url} name={name} accent={accent} accentContrast={accentContrast} size={128} />
                    <div className="mt-3 text-center">
                        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: accent }}>Photo Booth</p>
                        {location && <p className="text-xs mt-1 flex items-center justify-center gap-1" style={{ color: t.muted }}><MapPin size={10} />{location}</p>}
                    </div>
                </motion.div>

                <motion.div initial={{ opacity: 0, rotate: 6, y: 30 }} animate={{ opacity: 1, rotate: 2, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}
                    className="rounded-3xl p-6 md:p-8 shadow-2xl flex-1 border"
                    style={{ backgroundColor: t.surface, borderColor: t.border }}>
                    <h1 className={`text-3xl md:text-4xl font-black leading-tight mb-3 ${headingFontClass}`} style={{ color: t.text }}>
                        {name}
                    </h1>
                    {bio && <p className="text-sm leading-relaxed mb-5" style={{ color: t.muted }}>{bio}</p>}
                    <div className="flex flex-col sm:flex-row gap-2 mb-4">
                        <a href="#contact" className="flex-1 text-center px-5 py-2.5 rounded-full text-sm font-bold transition-opacity hover:opacity-80"
                            style={{ backgroundColor: accent, color: accentContrast }}>Book Now</a>
                        <a href="#portfolio" className="flex-1 text-center px-5 py-2.5 rounded-full text-sm font-bold border transition-opacity hover:opacity-70"
                            style={{ borderColor: t.border, color: t.text }}>Portfolio</a>
                    </div>
                    <LinkChips customLinks={customLinks} social={social} accent={accent} accentContrast={accentContrast} t={t} />
                </motion.div>
            </div>
        </section>
    );
}

// ─── Router ───────────────────────────────────────────────────────────────────

export default function HeroSection(props: HeroSectionProps) {
    switch (props.variant) {
        case 'split':        return <SplitHero        {...props} />;
        case 'cinematic':    return <CinematicHero    {...props} />;
        case 'editorial':    return <EditorialHero    {...props} />;
        case 'floating':     return <FloatingHero     {...props} />;
        case 'agency':       return <StudioHero       {...props} />;
        default:             return <GlassmorphismHero {...props} />;
    }
}
