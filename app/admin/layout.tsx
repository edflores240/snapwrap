'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!pathname.includes('/login')) {
            checkUser();
        } else {
            setLoading(false);
        }
    }, [pathname]);

    const checkUser = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            router.push('/admin/login');
        } else {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/admin/login');
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-pulse text-gray-600">Loading Admin Panel...</div>
            </div>
        );
    }

    const navItems = [
        { name: 'Dashboard', href: '/admin/dashboard', icon: '📊' },
        { name: 'Events', href: '/admin/events', icon: '📅' },
    ];

    // If on login page, render only children (full screen)
    if (pathname.includes('/login')) {
        return (
            <div className="min-h-screen bg-background-dark text-white">
                {children}
            </div>
        );
    }

    return (
        <div className="min-h-screen flex bg-gray-50">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r border-gray-200 flex flex-col fixed inset-y-0 left-0 z-50 shadow-sm">
                <div className="p-6 border-b border-gray-200">
                    <h1 className="text-xl font-bold">
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary-start to-primary-end">
                            SnapWrap Admin
                        </span>
                    </h1>
                </div>

                <nav className="flex-1 p-4 space-y-2">
                    {navItems.map((item) => {
                        const isActive = pathname.startsWith(item.href);
                        return (
                            <Link key={item.href} href={item.href}>
                                <div className={`
                  flex items-center gap-3 px-4 py-3 rounded-xl transition-all
                  ${isActive
                                        ? 'bg-gradient-to-r from-primary-start to-primary-end text-white shadow-lg shadow-primary-start/20'
                                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}\n                `}>
                                    <span>{item.icon}</span>
                                    <span className="font-medium">{item.name}</span>
                                </div>
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-gray-200">
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 px-4 py-3 w-full text-left rounded-xl text-gray-600 hover:bg-red-50 hover:text-red-600 transition-all"
                    >
                        <span>🚪</span>
                        <span className="font-medium">Sign Out</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 ml-64 p-8 bg-gray-50">
                <div className="max-w-7xl mx-auto">
                    {children}
                </div>
            </main>
        </div>
    );
}
