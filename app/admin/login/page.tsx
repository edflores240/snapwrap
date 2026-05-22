'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import { Inter, Playfair_Display, Caveat } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });
const playfair = Playfair_Display({ subsets: ['latin'] });
const caveat = Caveat({ subsets: ['latin'] });

export default function AdminLoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => {
        const checkUser = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) router.push('/admin/dashboard');
        };
        checkUser();
    }, [router]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) throw error;

            console.log('Login successful:', data);
            router.push('/admin/dashboard');
        } catch (err: any) {
            console.error('Login error:', err);
            setError(err.message || 'Failed to login');
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className={`min-h-screen relative flex items-center justify-center p-4 bg-[#FAF8F5] ${inter.className} text-[#2A2724] selection:bg-[#2A2724] selection:text-white overflow-hidden`}>

            {/* Decorative Background Elements */}
            <div className={`absolute top-10 left-10 md:left-20 rotate-[-8deg] ${caveat.className} text-2xl text-neutral-400 pointer-events-none opacity-40`}>
                Welcome back!
                <svg className="w-6 h-6 ml-2 scale-x-[-1] mt-1" viewBox="0 0 100 100"><path d="M10,10 Q50,50 90,10" fill="none" stroke="currentColor" strokeWidth="3" /></svg>
            </div>


            <div className="w-full max-w-md bg-white p-8 md:p-10 rounded-3xl border border-[#ECE8DF] shadow-sm relative z-10">

                <div className="text-center mb-8">
                    <h1 className={`text-4xl font-black mb-2 ${playfair.className} tracking-tight text-[#2A2724]`}>Admin Access</h1>
                    <p className="text-neutral-500 text-sm">Sign in to manage your events</p>
                </div>

                {error && (
                    <div className="bg-red-50 text-red-600 border border-red-100 p-4 rounded-xl mb-6 text-sm text-center font-medium">
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin} className="space-y-6">
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2 ml-1">
                            Email Address
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-[#FAF8F5] border border-[#ECE8DF] rounded-xl px-4 py-3 text-[#2A2724] focus:outline-none focus:border-[#2A2724] transition-all placeholder:text-neutral-300 text-sm"
                            placeholder="you@company.com"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2 ml-1">
                            Password
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-[#FAF8F5] border border-[#ECE8DF] rounded-xl px-4 py-3 text-[#2A2724] focus:outline-none focus:border-[#2A2724] transition-all placeholder:text-neutral-300 text-sm"
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    <Button
                        type="submit"
                        className="w-full bg-[#2A2724] text-white hover:bg-[#3D3935] rounded-xl py-4 font-bold tracking-wide transition-all text-sm h-12"
                        disabled={loading}
                    >
                        {loading ? 'Signing in...' : 'Sign In'}
                    </Button>
                </form>

                <div className="mt-8 text-center border-t border-[#ECE8DF] pt-6 space-y-3">
                    <p className="text-sm text-neutral-500">
                        Don&apos;t have an account?{' '}
                        <a href="/signup" className="font-bold text-[#2A2724] hover:underline">
                            Sign up free
                        </a>
                    </p>
                    <a href="/" className="block text-sm text-neutral-400 hover:text-[#2A2724] transition-colors font-medium">
                        ← Back to Home
                    </a>
                </div>
            </div>

            <div className="absolute bottom-6 text-center w-full text-[10px] text-neutral-300 uppercase tracking-widest">
                Developed by Jay Flores
            </div>
        </main>
    );
}
