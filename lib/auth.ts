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
    created_at: string;
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

export async function createProfile(userId: string, username: string, businessName?: string): Promise<Profile | null> {
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
        console.error('Error creating profile:', error);
        return null;
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
