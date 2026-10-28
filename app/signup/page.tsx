'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Inter, Playfair_Display, Caveat } from 'next/font/google';
import { Loader2 } from 'lucide-react';
import Logo from '@/components/ui/Logo';

const inter = Inter({ subsets: ['latin'] });
const playfair = Playfair_Display({ subsets: ['latin'] });
const caveat = Caveat({ subsets: ['latin'] });

export default function SignupPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const check = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) router.push('/admin/dashboard');
        };
        check();
    }, [router]);

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }
        if (password.length < 8) {
            setError('Password must be at least 8 characters.');
            return;
        }

        setLoading(true);
        try {
            const { data, error } = await supabase.auth.signUp({ email, password });
            if (error) throw error;
            if (data.user) {
                router.push('/onboarding');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to create account.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className={`min-h-screen relative flex items-center justify-center p-4 bg-[#FFF8F0] ${inter.className} text-neutral-900 overflow-hidden`}>
            <div className="absolute top-[20%] right-[15%] w-64 h-64 bg-[#FFE4E1] rounded-full blur-[100px] opacity-60 pointer-events-none" />
            <div className="absolute bottom-[20%] left-[10%] w-72 h-72 bg-[#E0F7FA] rounded-full blur-[100px] opacity-60 pointer-events-none" />

            <div className={`absolute top-10 left-10 md:left-20 rotate-[-8deg] ${caveat.className} text-2xl text-neutral-400 pointer-events-none opacity-50`}>
                Join SnapWrap!
            </div>

            <div className="w-full max-w-md bg-white p-8 md:p-10 rounded-2xl shadow-2xl border border-neutral-100 relative z-10">
                <div className="text-center mb-8">
                    <h1 className={`text-4xl font-bold mb-2 ${playfair.className} tracking-tight`}>Create Account</h1>
                    <p className="text-neutral-500 text-sm">Start your photo booth business for free</p>
                </div>

                {error && (
                    <div className="bg-red-50 text-red-600 border border-red-100 p-4 rounded-xl mb-6 text-sm text-center font-medium">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSignup} className="space-y-5">
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2 ml-1">
                            Email Address
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all placeholder:text-neutral-300"
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
                            className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all placeholder:text-neutral-300"
                            placeholder="Min. 8 characters"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2 ml-1">
                            Confirm Password
                        </label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3 text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent transition-all placeholder:text-neutral-300"
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-neutral-900 text-white rounded-xl py-4 font-bold tracking-wide shadow-lg hover:bg-neutral-800 hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2 mt-2"
                    >
                        {loading ? (
                            <><Loader2 size={16} className="animate-spin" /> Creating account...</>
                        ) : (
                            'Create Account'
                        )}
                    </button>
                </form>

                <div className="mt-8 text-center border-t border-neutral-100 pt-6 space-y-3">
                    <p className="text-sm text-neutral-500">
                        Already have an account?{' '}
                        <Link href="/admin/login" className="font-bold text-neutral-900 hover:underline">
                            Sign in
                        </Link>
                    </p>
                    <Link href="/" className="block text-sm text-neutral-400 hover:text-neutral-900 transition-colors font-medium">
                        ← Back to Home
                    </Link>
                </div>
            </div>

            <div className="absolute bottom-6 flex flex-col items-center gap-2 w-full text-[10px] text-neutral-300 uppercase tracking-widest">
                <Logo size={24} className="opacity-60" />
                SnapWrap
            </div>
        </main>
    );
}
