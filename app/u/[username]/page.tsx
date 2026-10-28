import { cache } from 'react';
import { notFound } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import type { Profile, ServicePackage } from '@/lib/auth';
import { migrateToCustomLinks } from '@/lib/auth';
import { Inter, Playfair_Display, Space_Grotesk } from 'next/font/google';
import ProfileView from './ProfileView';
import { deriveTheme } from '@/lib/color-utils';

const inter = Inter({ subsets: ['latin'] });
const playfair = Playfair_Display({ subsets: ['latin'] });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'] });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Props {
    params: Promise<{ username: string }>;
    searchParams: Promise<{
        layout?: string;
        accent?: string;
        dark?: string;
        bg?: string;
        surface?: string;
        text?: string;
        muted?: string;
        border?: string;
        card?: string;
        // Section style overrides
        hs?: string; // hero style
        ps?: string; // portfolio style
        ss?: string; // services style
        ts?: string; // testimonials style
        cs?: string; // contact style
    }>;
}

type Layout = 'classic' | 'bold' | 'sidebar';

const getData = cache(async (username: string) => {
    const { data: profile } = await supabase
        .from('profiles')
        .select('id, username, business_name, bio, logo_url, location, website, services, social_links, accent_color, dark_mode, profile_layout, custom_colors, testimonials, section_styles, custom_links, created_at')
        .eq('username', username)
        .single();
    if (!profile) return null;

    // Fetch active events and their latest published photo thumbnail in a single query
    const { data: events } = await supabase
        .from('events')
        .select(`
            id,
            name,
            slug,
            date,
            photos (
                image_url
            )
        `)
        .eq('user_id', profile.id)
        .eq('is_active', true)
        .eq('photos.is_published', true)
        .order('created_at', { ascending: false, foreignTable: 'photos' })
        .limit(1, { foreignTable: 'photos' })
        .order('date', { ascending: false })
        .limit(6);

    const portfolioItems = (events ?? []).map((event) => {
        const photos = event.photos as { image_url: string }[] | undefined;
        return {
            id: event.id,
            name: event.name,
            slug: event.slug,
            date: event.date,
            thumbnail: photos?.[0]?.image_url ?? null
        };
    });

    return { profile: profile as Profile, portfolioItems };
});

export async function generateMetadata({ params }: Props) {
    const { username } = await params;
    const data = await getData(username);
    if (!data) return { title: 'Not Found' };
    const name = data.profile.business_name || data.profile.username;
    return {
        title: `${name} — SnapWrap`,
        description: data.profile.bio || `Photo booth services by ${name}`,
    };
}

export default async function PublicProfilePage({ params, searchParams }: Props) {
    const { username } = await params;
    const sp = await searchParams;
    const data = await getData(username);
    if (!data) notFound();

    const { profile, portfolioItems } = data;
    const name = profile.business_name || profile.username;
    const services: ServicePackage[] = Array.isArray(profile.services) ? profile.services : [];
    const testimonials = Array.isArray(profile.testimonials) ? profile.testimonials : [];
    const social = profile.social_links ?? {};
    const customLinks = migrateToCustomLinks(social, Array.isArray(profile.custom_links) ? profile.custom_links : []);
    const savedSectionStyles = (profile.section_styles as Record<string, string>) ?? {};

    // Resolve accent + dark mode (query params override saved profile settings)
    const accent = sp.accent || profile.accent_color || '#171717';
    const darkMode = sp.dark === '1' || (profile.dark_mode ?? false);

    // Build per-section overrides from query params (used for live preview in admin)
    const qpOverrides: Record<string, string> = {};
    if (sp.bg) qpOverrides.bg = sp.bg;
    if (sp.surface) qpOverrides.surface = sp.surface;
    if (sp.text) qpOverrides.text = sp.text;
    if (sp.muted) qpOverrides.muted = sp.muted;
    if (sp.border) qpOverrides.border = sp.border;
    if (sp.card) qpOverrides.card = sp.card;

    // Merge: saved custom_colors < query param overrides
    const savedCustom = (profile.custom_colors as Record<string, string> | null) ?? {};
    const colorOverrides = { ...savedCustom, ...qpOverrides };

    const t = deriveTheme(accent, darkMode, Object.keys(colorOverrides).length ? colorOverrides : undefined);

    const layout = (sp.layout || profile.profile_layout || 'classic') as Layout;

    // Font selection: dark mode gets modern sans, light mode gets editorial serif heading
    const fontClass = darkMode ? spaceGrotesk.className : inter.className;
    const headingFontClass = darkMode ? spaceGrotesk.className : playfair.className;

    // Section styles: saved DB values overridden by query params for live preview
    const sectionStyles = {
        navbar: savedSectionStyles.navbar || 'classic',
        hero: sp.hs || savedSectionStyles.hero || layout,
        portfolio: sp.ps || savedSectionStyles.portfolio || 'carousel',
        services: sp.ss || savedSectionStyles.services || 'cards',
        testimonials: sp.ts || savedSectionStyles.testimonials || 'grid',
        contact: sp.cs || savedSectionStyles.contact || 'centered',
        stats: savedSectionStyles.stats || 'bar',
        how_it_works: savedSectionStyles.how_it_works || 'steps',
        hide_navbar:       savedSectionStyles.hide_navbar,
        hide_hero:         savedSectionStyles.hide_hero,
        hide_stats:        savedSectionStyles.hide_stats,
        hide_portfolio:    savedSectionStyles.hide_portfolio,
        hide_testimonials: savedSectionStyles.hide_testimonials,
        hide_how_it_works: savedSectionStyles.hide_how_it_works,
        hide_services:     savedSectionStyles.hide_services,
        hide_contact:      savedSectionStyles.hide_contact,
    };

    return (
        <ProfileView
            name={name}
            username={profile.username}
            bio={profile.bio}
            location={profile.location}
            website={profile.website}
            logo_url={profile.logo_url}
            services={services}
            testimonials={testimonials}
            social={social}
            customLinks={customLinks}
            portfolioItems={portfolioItems}
            accent={accent}
            t={t}
            layout={layout}
            sectionStyles={sectionStyles}
            fontClass={fontClass}
            headingFontClass={headingFontClass}
        />
    );
}
