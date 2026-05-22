'use client';

import { useState, useEffect } from 'react';
import type { ServicePackage, SocialLinks, Testimonial, CustomLink } from '@/lib/auth';
import type { ThemeColors } from '@/lib/color-utils';
import { getContrastColor, deriveTheme } from '@/lib/color-utils';
import { Inter, Playfair_Display, Space_Grotesk } from 'next/font/google';
import NavbarSection from './sections/NavbarSection';
import Link from 'next/link';
import HeroSection from './sections/HeroSection';
import StatsSection from './sections/StatsSection';
import PortfolioSection from './sections/PortfolioSection';
import TestimonialsSection from './sections/TestimonialsSection';
import HowItWorksSection from './sections/HowItWorksSection';
import ServicesSection from './sections/ServicesSection';
import ContactSection from './sections/ContactSection';

const inter = Inter({ subsets: ['latin'] });
const playfair = Playfair_Display({ subsets: ['latin'] });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'] });

export interface PortfolioItem {
    id: string;
    name: string;
    slug: string;
    date: string;
    thumbnail: string | null;
}

export interface SectionStyles {
    navbar?: string; hero?: string; hero_bg?: string; portfolio?: string;
    services?: string; testimonials?: string; contact?: string;
    stats?: string; how_it_works?: string;
    hide_navbar?: string; hide_hero?: string; hide_stats?: string;
    hide_portfolio?: string; hide_testimonials?: string; hide_how_it_works?: string;
    hide_services?: string; hide_contact?: string;
}

export interface ProfileViewProps {
    name: string;
    username: string;
    bio: string | null;
    location: string | null;
    website: string | null;
    logo_url: string | null;
    services: ServicePackage[];
    testimonials: Testimonial[];
    social: SocialLinks;
    customLinks: CustomLink[];
    portfolioItems: PortfolioItem[];
    accent: string;
    t: ThemeColors;
    layout: 'classic' | 'bold' | 'sidebar';
    sectionStyles: SectionStyles;
    fontClass: string;
    headingFontClass: string;
}

export default function ProfileView(props: ProfileViewProps) {
    const {
        name, username, bio, location, website,
        services, testimonials, social, customLinks, portfolioItems,
    } = props;

    // Live state — overridden by postMessage from the appearance editor
    const [liveAccent, setLiveAccent] = useState(props.accent);
    const [liveT, setLiveT] = useState<ThemeColors>(props.t);
    const [liveDarkMode, setLiveDarkMode] = useState(false);
    const [liveLayout, setLiveLayout] = useState(props.layout);
    const [liveSectionStyles, setLiveSectionStyles] = useState(props.sectionStyles);
    const [liveLogo, setLiveLogo] = useState(props.logo_url);
    const [liveCustomLinks, setLiveCustomLinks] = useState(props.customLinks);

    // Font classes derived from live dark mode
    const liveFontClass = liveDarkMode ? spaceGrotesk.className : inter.className;
    const liveHeadingFontClass = liveDarkMode ? spaceGrotesk.className : playfair.className;

    // Listen for postMessage from the appearance editor iframe parent
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.data?.type !== 'SNAPWRAP_PREVIEW') return;
            const { accent: a, darkMode: dm, layout: l, overrides, sectionStyles: ss, logo_url: lu, customLinks: cl } = event.data;
            const newT = deriveTheme(a, dm, Object.keys(overrides ?? {}).length ? overrides : undefined);
            setLiveAccent(a);
            setLiveDarkMode(dm);
            setLiveT(newT);
            setLiveLayout(l);
            setLiveSectionStyles(ss ?? {});
            if (lu !== undefined) setLiveLogo(lu);
            if (cl !== undefined) setLiveCustomLinks(cl);
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    const accentContrast = getContrastColor(liveAccent);
    const filled = portfolioItems.filter(p => p.thumbnail);

    // Derived stats
    const avgRating = testimonials.length > 0
        ? parseFloat((testimonials.reduce((s, t) => s + (t.rating ?? 5), 0) / testimonials.length).toFixed(1))
        : 5.0;

    const navbarVariant = liveSectionStyles.navbar ?? 'minimal';
    const heroVariant = liveSectionStyles.hero ?? liveLayout;
    const heroBg = liveSectionStyles.hero_bg;
    const portfolioVariant = liveSectionStyles.portfolio ?? 'carousel';
    const servicesVariant = liveSectionStyles.services ?? 'cards';
    const testimonialsVariant = liveSectionStyles.testimonials ?? 'grid';
    const contactVariant = liveSectionStyles.contact ?? 'centered';
    const statsVariant = (liveSectionStyles.stats ?? 'bar') as 'bar' | 'cards' | 'minimal';
    const howItWorksVariant = (liveSectionStyles.how_it_works ?? 'steps') as 'steps' | 'timeline' | 'numbered';
    const navbarHidden      = liveSectionStyles.hide_navbar      === 'true';
    const heroHidden        = liveSectionStyles.hide_hero        === 'true';
    const statsHidden       = liveSectionStyles.hide_stats       === 'true';
    const portfolioHidden   = liveSectionStyles.hide_portfolio   === 'true';
    const testimonialsHidden= liveSectionStyles.hide_testimonials=== 'true';
    const howItWorksHidden  = liveSectionStyles.hide_how_it_works=== 'true';
    const servicesHidden    = liveSectionStyles.hide_services    === 'true';
    const contactHidden     = liveSectionStyles.hide_contact     === 'true';

    return (
        <div className={`min-h-screen antialiased ${liveFontClass}`} style={{ backgroundColor: liveT.bg, color: liveT.text }}>

            {!navbarHidden && (
                <NavbarSection
                    name={name} username={username} website={website} logo_url={liveLogo}
                    location={location} customLinks={liveCustomLinks}
                    accent={liveAccent} accentContrast={accentContrast} t={liveT}
                    headingFontClass={liveHeadingFontClass} variant={navbarVariant}
                />
            )}

            {/* Ghost nav is fixed — push content down so hero isn't hidden under it */}
            {!navbarHidden && navbarVariant === 'ghost' && <div className="h-16" />}

            {!heroHidden && (
                <HeroSection
                    name={name} bio={bio} location={location} website={website}
                    logo_url={liveLogo} social={social} customLinks={liveCustomLinks}
                    accent={liveAccent} accentContrast={accentContrast} t={liveT}
                    headingFontClass={liveHeadingFontClass} fontClass={liveFontClass}
                    variant={heroVariant} heroBg={heroBg}
                />
            )}

            {!statsHidden && (
                <StatsSection
                    accent={liveAccent} accentContrast={accentContrast} t={liveT}
                    headingFontClass={liveHeadingFontClass}
                    eventCount={portfolioItems.length}
                    reviewCount={testimonials.length}
                    avgRating={avgRating}
                    variant={statsVariant}
                />
            )}

            {!portfolioHidden && (
                <div id="portfolio">
                    <PortfolioSection
                        items={filled}
                        accent={liveAccent} accentContrast={accentContrast} t={liveT}
                        headingFontClass={liveHeadingFontClass}
                        variant={portfolioVariant}
                    />
                </div>
            )}

            {!testimonialsHidden && (
                <div id="testimonials">
                    <TestimonialsSection
                        testimonials={testimonials}
                        accent={liveAccent} accentContrast={accentContrast} t={liveT}
                        headingFontClass={liveHeadingFontClass}
                        variant={testimonialsVariant}
                        username={username}
                    />
                </div>
            )}

            {!howItWorksHidden && (
                <HowItWorksSection
                    accent={liveAccent} accentContrast={accentContrast} t={liveT}
                    headingFontClass={liveHeadingFontClass}
                    variant={howItWorksVariant}
                />
            )}

            {!servicesHidden && (
                <div id="services">
                    <ServicesSection
                        services={services}
                        accent={liveAccent} accentContrast={accentContrast} t={liveT}
                        headingFontClass={liveHeadingFontClass}
                        variant={servicesVariant}
                    />
                </div>
            )}

            {!contactHidden && (
                <ContactSection
                    name={name} website={website} social={social} customLinks={liveCustomLinks}
                    accent={liveAccent} accentContrast={accentContrast} t={liveT}
                    headingFontClass={liveHeadingFontClass} fontClass={liveFontClass}
                    variant={contactVariant}
                />
            )}

            <footer className="py-8 px-4 text-center border-t transition-colors duration-300" style={{ borderColor: liveT.border }}>
                <p className="text-xs" style={{ color: liveT.muted }}>
                    Powered by <Link href="/" className="font-bold hover:underline" style={{ color: liveT.text }}>SnapWrap</Link> · Photo Booth Platform
                </p>
            </footer>
        </div>
    );
}
