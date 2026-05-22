import { supabase } from './supabase';

export interface Profile {
    id: string;
    username: string;
    business_name: string | null;
    bio: string | null;
    logo_url: string | null;
    location: string | null;
    website: string | null;
    services: ServicePackage[];
    social_links: SocialLinks;
    stripe_customer_id: string | null;
    subscription_status: 'free' | 'pro' | 'business';
    subscription_period_end: string | null;
    events_created_this_month: number;
    ai_credits_used_this_month: number;
    accent_color: string;
    dark_mode: boolean;
    profile_theme: string;
    profile_layout: 'classic' | 'bold' | 'sidebar';
    testimonials: Testimonial[];
    section_styles: SectionStyles;
    custom_links: CustomLink[];
    custom_colors?: {
        bg?: string;
        surface?: string;
        text?: string;
        muted?: string;
        border?: string;
        card?: string;
    } | null;
    created_at: string;
}

export interface Testimonial {
    id: string;
    author: string;
    role?: string;
    company?: string;
    text: string;
    rating?: number;
}

export interface SectionStyles {
    navbar?: string;
    hero?: string;
    hero_bg?: string;
    portfolio?: string;
    services?: string;
    testimonials?: string;
    contact?: string;
}

export type CustomLinkIcon =
    | 'instagram' | 'facebook' | 'tiktok' | 'twitter'
    | 'youtube' | 'linkedin' | 'email' | 'phone' | 'website' | 'link';

export interface CustomLink {
    id: string;
    label: string;
    url: string;
    icon: CustomLinkIcon;
}

/** Returns the correct href for a custom link based on its icon type. */
export function resolveCustomLinkHref(icon: CustomLinkIcon, url: string): string {
    if (icon === 'phone') {
        if (url.startsWith('tel:')) return url;
        return `tel:${url.replace(/\s/g, '')}`;
    }
    if (icon === 'email') {
        if (url.startsWith('mailto:')) return url;
        return `mailto:${url}`;
    }
    return url;
}

export function migrateToCustomLinks(social: SocialLinks, existing: CustomLink[]): CustomLink[] {
    if (existing.length > 0) return existing;
    const links: CustomLink[] = [];
    if (social.instagram) links.push({ id: 'ig', label: 'Instagram', url: social.instagram, icon: 'instagram' });
    if (social.facebook)  links.push({ id: 'fb', label: 'Facebook',  url: social.facebook,  icon: 'facebook'  });
    if (social.tiktok)    links.push({ id: 'tt', label: 'TikTok',    url: social.tiktok,    icon: 'tiktok'    });
    if (social.twitter)   links.push({ id: 'tw', label: 'Twitter',   url: social.twitter,   icon: 'twitter'   });
    return links;
}

export interface ServicePackage {
    id: string;
    title: string;
    description: string;
    price: string;
    features: string[];
}

export interface SocialLinks {
    instagram?: string;
    facebook?: string;
    tiktok?: string;
    twitter?: string;
}

export async function getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    return user;
}

export async function getCurrentProfile(): Promise<Profile | null> {
    const user = await getCurrentUser();
    if (!user) return null;

    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    if (error || !data) return null;
    return data as Profile;
}

export async function createProfile(userId: string, username: string, businessName?: string): Promise<Profile> {
    const { data, error } = await supabase
        .from('profiles')
        .insert({
            id: userId,
            username,
            business_name: businessName || null,
            subscription_status: 'free',
        })
        .select()
        .single();

    if (error) {
        console.error('Error creating profile:', error.message, '| code:', error.code, '| details:', error.details, '| hint:', error.hint);
        throw error;
    }
    return data as Profile;
}

export async function isUsernameTaken(username: string): Promise<boolean> {
    const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username)
        .single();
    return !!data;
}
