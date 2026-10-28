'use client';

import React, { useEffect, useState, createContext, useContext } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import type { Profile } from '@/lib/auth';
import { Inter, Playfair_Display } from 'next/font/google';
import Logo from '@/components/ui/Logo';

const inter = Inter({ subsets: ['latin'] });
const playfair = Playfair_Display({ subsets: ['latin'] });
import {
    LayoutDashboard,
    Calendar,
    LogOut,
    ChevronRight,
    UserCircle,
    Menu,
    X,
} from 'lucide-react';

// ── Context ─────────────────────────────────────────────────────────────────
interface AdminContextValue {
    user: User | null;
    profile: Profile | null;
    refreshProfile: () => Promise<void>;
    pendingReviewCount: number;
}

const AdminContext = createContext<AdminContextValue>({
    user: null,
    profile: null,
    refreshProfile: async () => {},
    pendingReviewCount: 0,
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
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [pendingReviewCount, setPendingReviewCount] = useState(0);

    const fetchProfile = async (userId: string) => {
        const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
        return (data as Profile) || null;
    };

    const fetchPendingCount = async (profileId: string) => {
        const { count } = await supabase
            .from('testimonial_submissions')
            .select('id', { count: 'exact', head: true })
            .eq('profile_id', profileId)
            .eq('status', 'pending');
        setPendingReviewCount(count ?? 0);
    };

    const refreshProfile = async () => {
        if (user) {
            const p = await fetchProfile(user.id);
            setProfile(p);
            if (p) fetchPendingCount(p.id);
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
        fetchPendingCount(p.id);
        setLoading(false);
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/admin/login');
    };

    if (loading) {
        return (
            <div className={`min-h-screen flex items-center justify-center bg-[#FAF8F5] ${inter.className}`}>
                <div className="flex flex-col items-center gap-4">
                    <Logo size={48} className="animate-pulse" />
                    <div className={`text-[#2A2724] text-sm font-black tracking-widest uppercase ${playfair.className}`}>SnapWrap</div>
                </div>
            </div>
        );
    }

    const navItems = [
        { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
        { name: 'Events', href: '/admin/events', icon: Calendar },
        { name: 'Profile', href: '/admin/profile', icon: UserCircle },
    ];

    if (pathname.includes('/login')) {
        return <div className={`min-h-screen bg-[#FAF8F5] ${inter.className}`}>{children}</div>;
    }

    const SidebarContent = () => (
        <>
            <div className="p-6 flex items-center justify-between border-b border-[#ECE8DF]">
                <Link href="/admin/dashboard" className="flex items-center gap-2 group" onClick={() => setSidebarOpen(false)}>
                    <Logo size={32} className="transition-transform group-hover:scale-105" />
                    <h1 className={`text-xl font-black tracking-tight ${playfair.className}`}>SnapWrap</h1>
                </Link>
                {/* Close button — mobile only */}
                <button
                    className="md:hidden p-1.5 rounded-lg text-neutral-400 hover:text-neutral-900 hover:bg-neutral-50 transition-all"
                    onClick={() => setSidebarOpen(false)}
                >
                    <X size={18} />
                </button>
            </div>

            <div className="px-4 py-2 flex-1 overflow-y-auto">
                <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-[0.2em] mb-3 ml-4">
                    Main Menu
                </div>
                <nav className="space-y-1">
                    {navItems.map((item) => {
                        const isActive = pathname.startsWith(item.href);
                        const Icon = item.icon;
                        const badge = item.name === 'Profile' && pendingReviewCount > 0 ? pendingReviewCount : 0;
                        return (
                            <Link key={item.href} href={item.href} onClick={() => setSidebarOpen(false)}>
                                <div className={`flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 group ${isActive ? 'bg-[#2A2724] text-white shadow-sm border border-[#2A2724]' : 'text-neutral-500 hover:bg-[#ECE8DF]/40 hover:text-[#2A2724]'}`}>
                                    <div className="flex items-center gap-3">
                                        <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                                        <span className="text-sm font-semibold tracking-tight">{item.name}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        {badge > 0 && (
                                            <span className={`flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-black ${isActive ? 'bg-white text-[#2A2724]' : 'bg-[#2A2724] text-white'}`}>
                                                {badge}
                                            </span>
                                        )}
                                        {isActive && <ChevronRight size={14} className="opacity-50" />}
                                    </div>
                                </div>
                            </Link>
                        );
                    })}
                </nav>
            </div>

            {/* User */}
            <div className="p-4 space-y-2 border-t border-[#ECE8DF]">
                {profile && (
                    <div className="px-4 py-1">
                        <p className="text-[10px] font-bold text-neutral-400 truncate">{profile.business_name || profile.username}</p>
                    </div>
                )}
                <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 px-4 py-3 w-full text-left rounded-xl text-neutral-400 hover:bg-red-50 hover:text-red-600 transition-all duration-200"
                >
                    <LogOut size={18} />
                    <span className="text-sm font-semibold tracking-tight">Sign Out</span>
                </button>
            </div>
        </>
    );

    return (
        <AdminContext.Provider value={{ user, profile, refreshProfile, pendingReviewCount }}>
            <div className={`min-h-screen flex bg-[#FAF8F5] text-[#2A2724] antialiased ${inter.className}`}>

                {/* ── Mobile overlay ── */}
                {sidebarOpen && (
                    <div
                        className="fixed inset-0 bg-[#2A2724]/20 backdrop-blur-sm z-40 md:hidden"
                        onClick={() => setSidebarOpen(false)}
                    />
                )}

                {/* ── Sidebar — desktop fixed, mobile slide-in ── */}
                <aside className={`
                    w-64 bg-white border-r border-[#ECE8DF] flex flex-col
                    fixed inset-y-0 left-0 z-50 overflow-hidden
                    transition-transform duration-300 ease-in-out
                    ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                    md:translate-x-0
                `}>
                    <SidebarContent />
                </aside>

                {/* ── Main ── */}
                <div className="flex-1 md:ml-64 min-h-screen flex flex-col">
                    {/* Mobile top bar */}
                    <div className="md:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-[#FAF8F5]/90 backdrop-blur-md border-b border-[#ECE8DF]">
                        <Link href="/admin/dashboard" className="flex items-center gap-2">
                            <Logo size={28} />
                            <span className={`font-black tracking-tight text-sm ${playfair.className}`}>SnapWrap</span>
                        </Link>
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="p-2 rounded-xl text-neutral-500 hover:bg-neutral-100 transition-all"
                        >
                            <Menu size={20} />
                        </button>
                    </div>

                    <main className="flex-1">
                        {pathname.includes('/appearance')
                            ? children
                            : <div className="max-w-6xl mx-auto p-5 md:p-12">{children}</div>
                        }
                    </main>
                </div>
            </div>
        </AdminContext.Provider>
    );
}
