import type { Profile } from './auth';

export type PlanName = 'free' | 'pro' | 'business';

export type Feature =
    | 'guest_capture'
    | 'profile_page'
    | 'ai_background'
    | 'unlimited_events'
    | 'realtime_gallery';

const PLAN_FEATURES: Record<PlanName, Feature[]> = {
    free: [],
    pro: ['guest_capture', 'profile_page', 'ai_background', 'unlimited_events', 'realtime_gallery'],
    business: ['guest_capture', 'profile_page', 'ai_background', 'unlimited_events', 'realtime_gallery'],
};

const MONTHLY_EVENT_LIMITS: Record<PlanName, number> = {
    free: 2,
    pro: Infinity,
    business: Infinity,
};

const AI_CREDIT_LIMITS: Record<PlanName, number> = {
    free: 0,
    pro: 20,
    business: Infinity,
};

export function canUseFeature(profile: Profile | null, feature: Feature): boolean {
    if (!profile) return false;
    const plan = (profile.subscription_status as PlanName) || 'free';
    return PLAN_FEATURES[plan]?.includes(feature) ?? false;
}

export function canCreateEvent(profile: Profile | null): boolean {
    if (!profile) return false;
    const plan = (profile.subscription_status as PlanName) || 'free';
    const limit = MONTHLY_EVENT_LIMITS[plan];
    if (limit === Infinity) return true;
    return profile.events_created_this_month < limit;
}

export function remainingAiCredits(profile: Profile | null): number {
    if (!profile) return 0;
    const plan = (profile.subscription_status as PlanName) || 'free';
    const limit = AI_CREDIT_LIMITS[plan];
    if (limit === Infinity) return 999;
    return Math.max(0, limit - profile.ai_credits_used_this_month);
}

export function getPlanLabel(status: string): string {
    const labels: Record<string, string> = { free: 'Free', pro: 'Pro', business: 'Business' };
    return labels[status] || 'Free';
}

export const PLANS = [
    {
        id: 'free' as PlanName,
        name: 'Free',
        price: '$0',
        priceMonthly: 0,
        description: 'Try it out',
        features: ['2 events / month', '50 photos per event', 'QR download links', 'Public gallery'],
        cta: 'Get started free',
        stripePriceId: null,
    },
    {
        id: 'pro' as PlanName,
        name: 'Pro',
        price: '$29',
        priceMonthly: 29,
        description: 'For active operators',
        features: ['Unlimited events', '500 photos per event', 'Guest self-capture', 'Public business profile', '20 AI backgrounds / month', 'Realtime gallery'],
        cta: 'Start Pro',
        stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID || '',
    },
    {
        id: 'business' as PlanName,
        name: 'Business',
        price: '$79',
        priceMonthly: 79,
        description: 'For high-volume teams',
        features: ['Everything in Pro', 'Unlimited photos', 'Unlimited AI backgrounds', 'Priority support'],
        cta: 'Start Business',
        stripePriceId: process.env.NEXT_PUBLIC_STRIPE_BUSINESS_PRICE_ID || '',
    },
];
