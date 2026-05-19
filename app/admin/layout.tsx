'use client';

import React, { useEffect, useState, createContext, useContext } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import type { Profile } from '@/lib/auth';
import { getPlanLabel } from '@/lib/plans';
import {
    LayoutDashboard,
    Calendar,
    LogOut,
    ChevronRight,
    Camera,
    UserCircle,
    CreditCard,
} from 'lucide-react';

// ── Context ─────────────────────────────────────────────────────────────────
interface AdminContextValue {
    user: User | null;
    profile: Profile | null;
    refreshProfile: () => Promise<void>;
}

const AdminContext = createContext<AdminContextValue>({
    user: null,
    profile: null,
    refreshProfile: async () => {},
});

export function useAdmin() {
    return useContext(AdminContext);
}

// ── Layout ───────────────────────────────────────────────────────────────────
export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);

    const fetchProfile = async (userId: string) => {
        const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
        return (data as Profile) || null;
    };

    const refreshProfile = async () => {
        if (user) {
            const p = await fetchProfile(user.id);
            setProfile(p);
        }
    };

    useEffect(() => {
        checkUser();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_OUT' || !session) {
                router.push('/admin/login');
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const checkUser = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            if (!pathname.includes('/login')) router.push('/admin/login');
            setLoading(false);
            return;
        }

        setUser(session.user);

        // Skip profile check on login/onboarding pages
        if (pathname.includes('/login') || pathname.includes('/onboarding')) {
            setLoading(false);
            return;
        }

        const p = await fetchProfile(session.user.id);
        if (!p) {
            // First time — send to onboarding
            router.push('/onboarding');
            return;
        }

        setProfile(p);
        setLoading(false);
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/admin/login');
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#F7F7F5]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-2 border-neutral-200 border-t-neutral-900 rounded-full animate-spin" />
                    <div className="text-neutral-400 text-sm font-medium tracking-wide uppercase">SnapWrap</div>
                </div>
            </div>
        );
    }

    const navItems = [
        { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
        { name: 'Events', href: '/admin/events', icon: Calendar },
        { name: 'Profile', href: '/admin/profile', icon: UserCircle },
        { name: 'Billing', href: '/admin/billing', icon: CreditCard },
    ];

    if (pathname.includes('/login')) {
        return <div className="min-h-screen bg-[#F7F7F5]">{children}</div>;
    }

    return (
        <AdminContext.Provider value={{ user, profile, refreshProfile }}>
            <div className="min-h-screen flex bg-[#F7F7F5] text-neutral-900 antialiased relative overflow-hidden">
                {/* Background branded elements */}
                <div className="fixed -right-24 -bottom-24 w-96 h-96 opacity-[0.03] pointer-events-none select-none">
                    <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
                        <path fill="currentColor" d="M44.7,-76.4C58.1,-69.2,69.2,-58.1,76.4,-44.7C83.7,-31.3,87.1,-15.7,87.1,0C87.1,15.7,83.7,31.3,76.4,44.7C69.2,58.1,58.1,69.2,44.7,76.4C31.3,83.7,15.7,87.1,0,87.1C-15.7,87.1,-31.3,83.7,-44.7,76.4C-58.1,69.2,-69.2,58.1,-76.4,44.7C-83.7,31.3,-87.1,15.7,-87.1,0C-87.1,-15.7,-83.7,-31.3,-76.4,-44.7C-69.2,-58.1,-58.1,-69.2,-44.7,-76.4C-31.3,-83.7,-15.7,-87.1,0,-87.1C15.7,-87.1,31.3,-83.7,44.7,-76.4Z" transform="translate(100 100)" />
                    </svg>
                </div>
                <div className="fixed -left-24 -top-24 w-[500px] h-[500px] opacity-[0.02] pointer-events-none select-none rotate-45">
                    <div className="w-full h-full border-[40px] border-neutral-900 rounded-full" />
                </div>

                {/* Sidebar */}
                <aside className="w-64 bg-white border-r border-neutral-100 flex flex-col fixed inset-y-0 left-0 z-50 overflow-hidden">
                    <div className="absolute right-0 top-0 bottom-0 w-1 flex flex-col gap-1 py-1 opacity-[0.05]">
                        {Array.from({ length: 40 }).map((_, i) => (
                            <div key={i} className="w-full h-1 bg-neutral-900 rounded-sm" />
                        ))}
                    </div>

                    <div className="p-8">
                        <Link href="/admin/dashboard" className="flex items-center gap-2 group">
                            <div className="w-8 h-8 bg-neutral-900 rounded-lg flex items-center justify-center text-white transition-transform group-hover:scale-105">
                                <Camera size={18} />
                            </div>
                            <h1 className="text-xl font-bold tracking-tight">SnapWrap</h1>
                        </Link>
                    </div>

                    <div className="px-4 py-2">
                        <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-[0.2em] mb-4 ml-4">
                            Main Menu
                        </div>
                        <nav className="space-y-1">
                            {navItems.map((item) => {
                                const isActive = pathname.startsWith(item.href);
                                const Icon = item.icon;
                                return (
                                    <Link key={item.href} href={item.href}>
                                        <div className={`flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 group ${isActive ? 'bg-neutral-900 text-white shadow-md shadow-neutral-200' : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900'}`}>
                                            <div className="flex items-center gap-3">
                                                <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                                                <span className="text-sm font-semibold tracking-tight">{item.name}</span>
                                            </div>
                                            {isActive && <ChevronRight size={14} className="opacity-50" />}
                                        </div>
                                    </Link>
                                );
                            })}
                        </nav>
                    </div>

                    {/* Plan badge + user */}
                    <div className="mt-auto p-4 space-y-2 border-t border-neutral-50">
                        {profile && (
                            <div className="px-4 py-2 rounded-xl bg-neutral-50 flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Plan</p>
                                    <p className="text-xs font-bold text-neutral-700">{getPlanLabel(profile.subscription_status)}</p>
                                </div>
                                <Link href="/admin/billing" className="text-[10px] font-black text-indigo-500 uppercase tracking-widest hover:text-indigo-700">
                                    Upgrade
                                </Link>
                            </div>
                        )}
                        {profile && (
                            <div className="px-4 py-1">
                                <p className="text-[10px] font-bold text-neutral-400 truncate">{profile.business_name || profile.username}</p>
                            </div>
                        )}
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-3 px-4 py-3 w-full text-left rounded-xl text-neutral-400 hover:bg-red-50 hover:text-red-600 transition-all duration-200 group"
                        >
                            <LogOut size={18} />
                            <span className="text-sm font-semibold tracking-tight">Sign Out</span>
                        </button>
                    </div>
                </aside>

                <main className="flex-1 ml-64 min-h-screen">
                    <div className="max-w-6xl mx-auto p-12">
                        {children}
                    </div>
                </main>
            </div>
        </AdminContext.Provider>
    );
}
